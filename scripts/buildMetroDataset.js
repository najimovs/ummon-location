import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const outputDirectory = path.join( rootDirectory, "public/data" )
const stationsFile = path.join( outputDirectory, "metro-stations.geojson" )
const entrancesFile = path.join( outputDirectory, "metro-entrances.geojson" )
const metadataFile = path.join( outputDirectory, "metro-metadata.json" )
const endpoint = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter"
const bbox = "41.15,69.10,41.45,69.50"
const query = `[out:json][timeout:180];
(
  nwr["railway"="station"]["station"="subway"](${ bbox });
  node["railway"="subway_entrance"](${ bbox });
);
out center tags;`

const normalizeName = value => String( value || "" )
	.toLocaleLowerCase()
	.replace( /[’'`ʻʼ]/g, "" )
	.replace( /\([^)]*\)/g, " " )
	.replace( /\b(?:metro|station|stansiya|bekati|станция|метро)\b/gu, " " )
	.replace( /[^\p{L}\p{N}]+/gu, " " )
	.trim()
	.replace( /\s+/g, " " )

const coordinatesOf = element => {
	const longitude = element.lon ?? element.center?.lon
	const latitude = element.lat ?? element.center?.lat
	return Number.isFinite( longitude ) && Number.isFinite( latitude ) ? [ longitude, latitude ] : null
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

const response = await fetch( `${ endpoint }?data=${ encodeURIComponent( query ) }`, {
	headers: { "user-agent": "UmmonLocation/1.0" },
} )

if( !response.ok ) {
	throw new Error( `Overpass request failed: ${ response.status } ${ response.statusText }` )
}

const data = await response.json()
const fetchedAt = new Date().toISOString()
const stationElements = data.elements.filter( element => {
	const tags = element.tags || {}
	return tags.railway === "station" && tags.station === "subway"
} )
const entranceElements = data.elements.filter( element => element.tags?.railway === "subway_entrance" )
const stationGroups = new Map()

stationElements.forEach( element => {
	const coordinates = coordinatesOf( element )
	const name = element.tags?.[ "name:uz" ] || element.tags?.name
	const normalizedName = normalizeName( name )
	if( !coordinates || !normalizedName ) {
		return
	}
	const current = stationGroups.get( normalizedName )
	const record = { element, coordinates, name }
	if( !current || element.type === "node" ) {
		stationGroups.set( normalizedName, record )
	}
} )

const stations = [ ...stationGroups.entries() ].map( ( [ normalizedName, record ] ) => {
	const { element, coordinates, name } = record
	return {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties: {
			id: `osm-${ element.type }-${ element.id }`,
			name,
			nameUz: element.tags?.[ "name:uz" ] || null,
			nameRu: element.tags?.[ "name:ru" ] || null,
			nameEn: element.tags?.[ "name:en" ] || null,
			normalizedName,
			operator: element.tags?.operator || null,
			network: element.tags?.network || null,
			wheelchair: element.tags?.wheelchair || "unknown",
			entranceCount: 0,
			entranceIds: [],
			source: "openstreetmap",
			sourceId: `${ element.type }/${ element.id }`,
		},
	}
} )

const entrances = entranceElements.flatMap( element => {
	const coordinates = coordinatesOf( element )
	if( !coordinates ) {
		return []
	}
	const nearest = stations
		.map( station => ( { station, distance: distanceMeters( coordinates, station.geometry.coordinates ) } ) )
		.filter( item => item.distance <= 1200 )
		.sort( ( first, second ) => first.distance - second.distance )[ 0 ]
	const id = `osm-node-${ element.id }`
	if( nearest ) {
		nearest.station.properties.entranceCount++
		nearest.station.properties.entranceIds.push( id )
	}
	return [ {
		type: "Feature",
		geometry: { type: "Point", coordinates },
		properties: {
			id,
			name: element.tags?.name || null,
			ref: element.tags?.ref || null,
			access: element.tags?.entrance || "both",
			wheelchair: element.tags?.wheelchair || "unknown",
			stationId: nearest?.station.properties.id || null,
			stationName: nearest?.station.properties.name || null,
			distanceToStationCenter: nearest ? Math.round( nearest.distance ) : null,
			source: "openstreetmap",
			sourceId: `node/${ element.id }`,
		},
	} ]
} )

stations.sort( ( first, second ) => first.properties.name.localeCompare( second.properties.name, "uz" ) )
entrances.sort( ( first, second ) => String( first.properties.stationName ).localeCompare( String( second.properties.stationName ), "uz" ) )

const collection = features => ( {
	type: "FeatureCollection",
	metadata: {
		name: "Tashkent Metro",
		fetchedAt,
		source: "OpenStreetMap contributors",
		license: "ODbL-1.0",
		sourceUrl: "https://www.openstreetmap.org/copyright",
	},
	features,
} )

await mkdir( outputDirectory, { recursive: true } )
await writeFile( stationsFile, `${ JSON.stringify( collection( stations ) ) }\n` )
await writeFile( entrancesFile, `${ JSON.stringify( collection( entrances ) ) }\n` )
await writeFile( metadataFile, `${ JSON.stringify( {
	name: "Tashkent Metro dataset",
	fetchedAt,
	stationCount: stations.length,
	entranceCount: entrances.length,
	unmatchedEntranceCount: entrances.filter( feature => !feature.properties.stationId ).length,
	query,
	source: "© OpenStreetMap contributors",
	license: "ODbL-1.0",
	sourceUrl: "https://www.openstreetmap.org/copyright",
}, null, 2 ) }\n` )

console.log( `Metro dataset: ${ stations.length } stations, ${ entrances.length } entrances` )
