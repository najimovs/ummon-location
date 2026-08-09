import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const inputFile = path.join( rootDirectory, "data/fast-food-normalized.geojson" )
const outputFile = path.join( rootDirectory, "public/data/fast-food-final.geojson" )
const auditFile = path.join( rootDirectory, "data/fast-food-deduplication-audit.json" )

const genericNames = new Set( [
	"burger",
	"cafe",
	"fast food",
	"fastfood",
	"food court",
	"hot dog",
	"lavash",
	"pizza",
	"restaurant",
	"street food",
	"nomsiz fast food",
] )

const brands = [
	{ id: "bellissimo", patterns: [ "bellissimo" ] },
	{ id: "black-star-burger", patterns: [ "black star burger" ] },
	{ id: "chopar", patterns: [ "chopar" ] },
	{ id: "dodo-pizza", patterns: [ "dodo pizza" ] },
	{ id: "evos", patterns: [ "evos" ] },
	{ id: "feed-up", patterns: [ "feed up", "feedup" ] },
	{ id: "kfc", patterns: [ "kfc" ] },
	{ id: "les-ailes", patterns: [ "les ailes" ] },
	{ id: "max-way", patterns: [ "max way", "maxway" ] },
	{ id: "oqtepa-lavash", patterns: [ "oqtepa lavash", "oq tepa lavash" ] },
]

const transliteration = {
	а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
	к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
	х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
}

const normalizeName = value => String( value ?? "" )
	.toLocaleLowerCase()
	.split( "" )
	.map( character => transliteration[ character ] ?? character )
	.join( "" )
	.replace( /['’`ʻʼ]/g, "" )
	.replace( /\b(?:tashkent|toshkent|chilanzar|chilonzor|yunusobod|sergeli|filial|branch)\b/g, " " )
	.replace( /[^a-z0-9]+/g, " " )
	.trim()
	.replace( /\s+/g, " " )

const detectBrand = normalizedName => brands.find( brand =>
	brand.patterns.some( pattern => normalizedName.includes( pattern ) )
)?.id ?? null

const bigrams = value => {
	if( value.length < 2 ) {
		return new Set( [ value ] )
	}

	const result = new Set()
	for( let index = 0; index < value.length - 1; index++ ) {
		result.add( value.slice( index, index + 2 ) )
	}
	return result
}

const diceSimilarity = ( first, second ) => {
	if( first === second ) {
		return 1
	}
	if( !first || !second ) {
		return 0
	}

	const firstBigrams = bigrams( first )
	const secondBigrams = bigrams( second )
	let intersection = 0

	for( const value of firstBigrams ) {
		if( secondBigrams.has( value ) ) {
			intersection++
		}
	}

	return 2 * intersection / ( firstBigrams.size + secondBigrams.size )
}

const distanceMeters = ( first, second ) => {
	const earthRadius = 6371000
	const latitude1 = first[ 1 ] * Math.PI / 180
	const latitude2 = second[ 1 ] * Math.PI / 180
	const latitudeDelta = ( second[ 1 ] - first[ 1 ] ) * Math.PI / 180
	const longitudeDelta = ( second[ 0 ] - first[ 0 ] ) * Math.PI / 180
	const value = Math.sin( latitudeDelta / 2 ) ** 2
		+ Math.cos( latitude1 ) * Math.cos( latitude2 ) * Math.sin( longitudeDelta / 2 ) ** 2

	return earthRadius * 2 * Math.atan2( Math.sqrt( value ), Math.sqrt( 1 - value ) )
}

const shouldMerge = ( first, second ) => {
	if( first.properties.source === second.properties.source ) {
		return null
	}

	const distance = distanceMeters( first.geometry.coordinates, second.geometry.coordinates )
	if( distance > 100 ) {
		return null
	}

	const firstName = first.properties.normalizedName
	const secondName = second.properties.normalizedName
	const sameBrand = first.properties.brand && first.properties.brand === second.properties.brand
	const exactName = firstName === secondName && !genericNames.has( firstName )
	const similarity = diceSimilarity( firstName, secondName )
	const veryClose = distance <= 12

	if( sameBrand && distance <= 80 ) {
		return { distance, similarity, reason: "same brand" }
	}
	if( exactName && distance <= 70 ) {
		return { distance, similarity, reason: "exact name" }
	}
	if( similarity >= 0.84 && distance <= 55 ) {
		return { distance, similarity, reason: "similar name" }
	}
	if( veryClose && similarity >= 0.55 ) {
		return { distance, similarity, reason: "close and partially similar" }
	}
	if( veryClose && firstName === "nomsiz fast food" && secondName === "nomsiz fast food" ) {
		return { distance, similarity, reason: "unnamed at same location" }
	}

	return null
}

const collection = JSON.parse( await readFile( inputFile, "utf8" ) )
const features = collection.features.map( feature => ( {
	...feature,
	properties: {
		...feature.properties,
		normalizedName: normalizeName( feature.properties.name ),
		brand: detectBrand( normalizeName( feature.properties.name ) ),
	},
} ) )

const parent = features.map( ( _, index ) => index )
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

const latitudeCellSize = 0.001
const cells = new Map()
const cellKey = coordinates => `${ Math.floor( coordinates[ 0 ] / latitudeCellSize ) }:${ Math.floor( coordinates[ 1 ] / latitudeCellSize ) }`

features.forEach( ( feature, index ) => {
	const [ longitude, latitude ] = feature.geometry.coordinates
	const longitudeCell = Math.floor( longitude / latitudeCellSize )
	const latitudeCell = Math.floor( latitude / latitudeCellSize )

	for( let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++ ) {
		for( let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++ ) {
			const nearby = cells.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) ?? []
			for( const candidateIndex of nearby ) {
				if( shouldMerge( feature, features[ candidateIndex ] ) ) {
					union( index, candidateIndex )
				}
			}
		}
	}

	const key = cellKey( feature.geometry.coordinates )
	const cell = cells.get( key ) ?? []
	cell.push( index )
	cells.set( key, cell )
} )

const groups = new Map()
features.forEach( ( feature, index ) => {
	const root = find( index )
	const group = groups.get( root ) ?? []
	group.push( feature )
	groups.set( root, group )
} )

const choosePrimary = group => [ ...group ].sort( ( first, second ) => {
	const firstScore = ( first.properties.name === "Nomsiz fast food" ? 0 : 2 )
		+ ( first.properties.source === "osm" ? 1 : 0 )
		+ ( first.properties.confidence ?? 0 )
	const secondScore = ( second.properties.name === "Nomsiz fast food" ? 0 : 2 )
		+ ( second.properties.source === "osm" ? 1 : 0 )
		+ ( second.properties.confidence ?? 0 )
	return secondScore - firstScore
} )[ 0 ]

const mergeGroup = group => {
	const primary = choosePrimary( group )
	const sources = [ ...new Set( group.map( feature => feature.properties.source ) ) ].sort()
	const aliases = [ ...new Set( group.map( feature => feature.properties.name ).filter( name => name !== primary.properties.name ) ) ]
	const subtypes = [ ...new Set( group.map( feature => feature.properties.subtype ) ) ]
	const recordsBySource = Object.groupBy( group, feature => feature.properties.source )
	const sourceCoordinates = Object.values( recordsBySource ).map( records => [
		records.reduce( ( sum, feature ) => sum + feature.geometry.coordinates[ 0 ], 0 ) / records.length,
		records.reduce( ( sum, feature ) => sum + feature.geometry.coordinates[ 1 ], 0 ) / records.length,
	] )
	const coordinates = [
		sourceCoordinates.reduce( ( sum, item ) => sum + item[ 0 ], 0 ) / sourceCoordinates.length,
		sourceCoordinates.reduce( ( sum, item ) => sum + item[ 1 ], 0 ) / sourceCoordinates.length,
	]
	const sourceIds = Object.fromEntries( Object.entries( recordsBySource ).map( ( [ source, records ] ) => [
		source,
		[ ...new Set( records.map( feature => feature.properties.sourceId ) ) ],
	] ) )
	const id = createHash( "sha256" )
		.update( JSON.stringify( sourceIds ) )
		.digest( "hex" )
		.slice( 0, 16 )
	const sourceConfidence = Math.max( ...group.map( feature => feature.properties.confidence ?? 0 ) )
	const confidence = Math.min( 0.98, 0.54 + ( sources.length - 1 ) * 0.2 + ( primary.properties.name === "Nomsiz fast food" ? 0 : 0.08 ) + sourceConfidence * 0.12 )

	return {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties: {
			id: `poi_${ id }`,
			name: primary.properties.name,
			aliases,
			brand: primary.properties.brand,
			subtype: subtypes.length === 1 ? subtypes[ 0 ] : primary.properties.subtype,
			subtypes,
			sources,
			confidence: Number( confidence.toFixed( 3 ) ),
			address: group.find( feature => feature.properties.address )?.properties.address ?? null,
		},
	}
}

const finalFeatures = [ ...groups.values() ].map( mergeGroup )
	.sort( ( first, second ) => first.properties.name.localeCompare( second.properties.name ) )

const mergedGroups = [ ...groups.values() ].filter( group => group.length > 1 )
const suspiciousGroups = mergedGroups
	.filter( group => {
		const names = [ ...new Set( group.map( feature => feature.properties.normalizedName ) ) ]
		const maximumDistance = Math.max( ...group.flatMap( ( feature, index ) =>
			group.slice( index + 1 ).map( other => distanceMeters( feature.geometry.coordinates, other.geometry.coordinates ) )
		), 0 )
		return group.length > 3 || names.length > 2 || maximumDistance > 80
	} )
	.map( group => ( {
		records: group.map( feature => ( {
			name: feature.properties.name,
			source: feature.properties.source,
			coordinates: feature.geometry.coordinates,
		} ) ),
	} ) )

const output = {
	type: "FeatureCollection",
	metadata: {
		generatedAt: new Date().toISOString(),
		inputFeatureCount: features.length,
		featureCount: finalFeatures.length,
		mergedGroupCount: mergedGroups.length,
		deduplicated: true,
	},
	features: finalFeatures,
}

const audit = {
	metadata: output.metadata,
	sourceCombinations: Object.fromEntries(
		Object.entries( Object.groupBy( mergedGroups, group => [ ...new Set( group.map( item => item.properties.source ) ) ].sort().join( "+" ) ) )
			.map( ( [ key, value ] ) => [ key, value.length ] )
	),
	suspiciousGroups,
}

await mkdir( path.dirname( outputFile ), { recursive: true } )
await writeFile( outputFile, `${ JSON.stringify( output ) }\n` )
await writeFile( auditFile, `${ JSON.stringify( audit, null, "\t" ) }\n` )

console.log( `Deduplicated ${ features.length } records into ${ finalFeatures.length } POIs.` )
console.log( `Merged groups: ${ mergedGroups.length }` )
console.log( `Suspicious groups requiring review: ${ suspiciousGroups.length }` )
console.log( `Output: ${ path.relative( rootDirectory, outputFile ) }` )
