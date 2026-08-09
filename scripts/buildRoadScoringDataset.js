import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { simplify } from "@turf/turf"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const inputFile = path.join( rootDirectory, "public/data/extras/highway-line.geojson" )
const outputFile = path.join( rootDirectory, "public/data/roads-scoring.geojson" )
const metadataFile = path.join( rootDirectory, "public/data/roads-scoring-metadata.json" )

const roadClasses = {
	motorway: { label: "Avtomagistral", baseScore: 100, defaultSpeed: 100 },
	motorway_link: { label: "Magistral kirish yo‘li", baseScore: 92, defaultSpeed: 70 },
	trunk: { label: "Shaharlararo magistral", baseScore: 94, defaultSpeed: 80 },
	trunk_link: { label: "Magistral bog‘lamasi", baseScore: 88, defaultSpeed: 60 },
	primary: { label: "Asosiy shahar yo‘li", baseScore: 84, defaultSpeed: 60 },
	primary_link: { label: "Asosiy yo‘l bog‘lamasi", baseScore: 78, defaultSpeed: 50 },
	secondary: { label: "Ikkinchi darajali yo‘l", baseScore: 69, defaultSpeed: 50 },
	secondary_link: { label: "Ikkinchi darajali bog‘lama", baseScore: 64, defaultSpeed: 40 },
	tertiary: { label: "Mahalliy asosiy yo‘l", baseScore: 54, defaultSpeed: 40 },
	tertiary_link: { label: "Mahalliy yo‘l bog‘lamasi", baseScore: 50, defaultSpeed: 35 },
}

const parseNumber = value => {
	const match = String( value || "" ).match( /\d+/ )
	return match ? Number( match[ 0 ] ) : null
}
const roundCoordinates = coordinates => coordinates.map( coordinate => Array.isArray( coordinate[ 0 ] )
	? roundCoordinates( coordinate )
	: coordinate.map( value => Number( Number( value ).toFixed( 6 ) ) )
)

const input = JSON.parse( await readFile( inputFile, "utf8" ) )
const countsByClass = {}
const features = []

for( const feature of input.features || [] ) {
	const properties = feature.properties || {}
	const definition = roadClasses[ properties.HIGHWAY ]
	if( !definition || feature.geometry?.type !== "LineString" ) {
		continue
	}
	const lanes = parseNumber( properties.LANES )
	const maxspeed = parseNumber( properties.MAXSPEED ) || definition.defaultSpeed
	const laneBonus = lanes ? Math.min( 8, Math.max( 0, lanes - 2 ) * 2 ) : 0
	const speedBonus = Math.min( 5, Math.max( 0, maxspeed - definition.defaultSpeed ) / 10 )
	const flowScore = Math.min( 100, Math.round( definition.baseScore + laneBonus + speedBonus ) )
	const roadClass = properties.HIGHWAY
	countsByClass[ roadClass ] = ( countsByClass[ roadClass ] || 0 ) + 1
	const geometry = simplify( { type: "Feature", properties: {}, geometry: feature.geometry }, { tolerance: 0.000025, highQuality: false } ).geometry
	features.push( {
		type: "Feature",
		geometry: { type: "LineString", coordinates: roundCoordinates( geometry.coordinates ) },
		properties: {
			id: `osm-${ properties.OSM_TYPE }-${ properties.OSM_ID }`,
			name: properties.NAME || properties.NAME_EN || "Nomsiz yo‘l",
			nameEn: properties.NAME_EN || null,
			roadClass,
			roadClassLabel: definition.label,
			flowScore,
			lanes,
			maxspeed,
			oneway: properties.ONEWAY || "unknown",
			surface: properties.SURFACE || null,
			bridge: properties.BRIDGE === "yes",
			tunnel: properties.TUNNEL === "yes",
			source: "openstreetmap",
			sourceId: `${ properties.OSM_TYPE }/${ properties.OSM_ID }`,
		},
	} )
}

const generatedAt = new Date().toISOString()
const metadata = {
	generatedAt,
	featureCount: features.length,
	inputFeatureCount: input.features?.length || 0,
	excludedFeatureCount: ( input.features?.length || 0 ) - features.length,
	countsByClass,
	scoreMethod: "OSM road class baseline with lane and speed bonuses; proxy, not measured traffic",
	source: "© OpenStreetMap contributors",
	license: "ODbL-1.0",
	sourceUrl: "https://www.openstreetmap.org/copyright",
}

await writeFile( outputFile, `${ JSON.stringify( { type: "FeatureCollection", metadata, features } ) }\n` )
await writeFile( metadataFile, `${ JSON.stringify( metadata, null, 2 ) }\n` )

console.log( `Road scoring dataset: ${ features.length } of ${ metadata.inputFeatureCount } segments` )
console.table( countsByClass )
