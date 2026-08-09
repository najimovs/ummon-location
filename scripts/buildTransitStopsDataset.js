import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const inputFile = path.join( rootDirectory, "public/data/extras/public-transport-point.geojson" )
const outputFile = path.join( rootDirectory, "public/data/transit-stops.geojson" )
const metadataFile = path.join( rootDirectory, "public/data/transit-stops-metadata.json" )

const transliteration = {
	а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
}
const normalizeName = value => String( value || "" ).toLocaleLowerCase()
	.split( "" ).map( character => transliteration[ character ] ?? character ).join( "" )
	.replace( /[’'`ʻʼ]/g, "" ).replace( /[^a-z0-9]+/g, " " ).trim().replace( /\s+/g, " " )
const distanceMeters = ( first, second ) => {
	const earthRadius = 6371000
	const latitude1 = first[ 1 ] * Math.PI / 180
	const latitude2 = second[ 1 ] * Math.PI / 180
	const latitudeDelta = ( second[ 1 ] - first[ 1 ] ) * Math.PI / 180
	const longitudeDelta = ( second[ 0 ] - first[ 0 ] ) * Math.PI / 180
	const value = Math.sin( latitudeDelta / 2 ) ** 2 + Math.cos( latitude1 ) * Math.cos( latitude2 ) * Math.sin( longitudeDelta / 2 ) ** 2
	return earthRadius * 2 * Math.atan2( Math.sqrt( value ), Math.sqrt( 1 - value ) )
}

const input = JSON.parse( await readFile( inputFile, "utf8" ) )
const records = ( input.features || [] ).filter( feature => feature.geometry?.type === "Point" && (
	feature.properties?.HIGHWAY === "bus_stop"
	|| [ "platform", "stop_position" ].includes( feature.properties?.PUBLIC_TRA )
) ).map( feature => ( {
	...feature,
	properties: {
		...feature.properties,
		name: String( feature.properties.NAME || feature.properties.NAME_EN || "Nomsiz avtobus bekati" ).trim(),
		normalizedName: normalizeName( feature.properties.NAME || feature.properties.NAME_EN ),
	},
} ) )

const parent = records.map( ( _, index ) => index )
const find = index => {
	while( parent[ index ] !== index ) {
		parent[ index ] = parent[ parent[ index ] ]
		index = parent[ index ]
	}
	return index
}
const union = ( first, second ) => {
	const firstRoot = find( first )
	const secondRoot = find( second )
	if( firstRoot !== secondRoot ) {
		parent[ secondRoot ] = firstRoot
	}
}
const cellSize = 0.001
const cells = new Map()
records.forEach( ( feature, index ) => {
	const [ longitude, latitude ] = feature.geometry.coordinates
	const longitudeCell = Math.floor( longitude / cellSize )
	const latitudeCell = Math.floor( latitude / cellSize )
	for( let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++ ) {
		for( let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++ ) {
			for( const candidateIndex of cells.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) || [] ) {
				const candidate = records[ candidateIndex ]
				const distance = distanceMeters( feature.geometry.coordinates, candidate.geometry.coordinates )
				const sameNamedStop = feature.properties.normalizedName && feature.properties.normalizedName === candidate.properties.normalizedName
				if( ( sameNamedStop && distance <= 80 ) || ( !feature.properties.normalizedName && !candidate.properties.normalizedName && distance <= 12 ) ) {
					union( index, candidateIndex )
				}
			}
		}
	}
	const key = `${ longitudeCell }:${ latitudeCell }`
	const cell = cells.get( key ) || []
	cell.push( index )
	cells.set( key, cell )
} )

const groups = new Map()
records.forEach( ( feature, index ) => {
	const root = find( index )
	const group = groups.get( root ) || []
	group.push( feature )
	groups.set( root, group )
} )

const features = [ ...groups.values() ].map( group => {
	const named = group.find( feature => feature.properties.normalizedName ) || group[ 0 ]
	const coordinates = [
		group.reduce( ( sum, feature ) => sum + feature.geometry.coordinates[ 0 ], 0 ) / group.length,
		group.reduce( ( sum, feature ) => sum + feature.geometry.coordinates[ 1 ], 0 ) / group.length,
	].map( value => Number( value.toFixed( 6 ) ) )
	const sourceIds = group.map( feature => `${ feature.properties.OSM_TYPE }/${ feature.properties.OSM_ID }` ).sort()
	const types = [ ...new Set( group.map( feature => feature.properties.PUBLIC_TRA || feature.properties.HIGHWAY ).filter( Boolean ) ) ].sort()
	const refs = [ ...new Set( group.map( feature => feature.properties.REF ).filter( Boolean ) ) ].sort()
	const id = createHash( "sha256" ).update( sourceIds.join( "|" ) ).digest( "hex" ).slice( 0, 16 )
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties: {
			id: `transit_${ id }`,
			name: named.properties.name,
			nameEn: named.properties.NAME_EN || null,
			types,
			refs,
			recordCount: group.length,
			confidence: Number( Math.min( 0.96, 0.66 + ( group.length - 1 ) * 0.12 + ( named.properties.normalizedName ? 0.1 : 0 ) ).toFixed( 2 ) ),
			source: "openstreetmap",
			sourceIds,
		},
	}
} ).sort( ( first, second ) => first.properties.name.localeCompare( second.properties.name, "uz" ) )

const namedCount = features.filter( feature => feature.properties.name !== "Nomsiz avtobus bekati" ).length
const generatedAt = new Date().toISOString()
const metadata = {
	generatedAt,
	inputFeatureCount: input.features?.length || 0,
	selectedRecordCount: records.length,
	featureCount: features.length,
	namedCount,
	unnamedCount: features.length - namedCount,
	mergedRecordCount: records.length - features.length,
	deduplication: "Same normalized name within 80 m; unnamed records within 12 m",
	source: "© OpenStreetMap contributors",
	license: "ODbL-1.0",
	sourceUrl: "https://www.openstreetmap.org/copyright",
}

await writeFile( outputFile, `${ JSON.stringify( { type: "FeatureCollection", metadata, features } ) }\n` )
await writeFile( metadataFile, `${ JSON.stringify( metadata, null, 2 ) }\n` )
console.log( `Transit stops: ${ features.length } stops from ${ records.length } records (${ metadata.mergedRecordCount } merged)` )
