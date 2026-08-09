import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { classifyFoursquare, classifyOsm, classifyOverture } from "./poi/fastFoodClassification.js"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const poiDirectory = path.join( rootDirectory, "public/poi" )
const outputDirectory = path.join( rootDirectory, "data" )
const outputFile = path.join( outputDirectory, "fast-food-normalized.geojson" )

const sources = [
	{ file: "poi-fsq-point.geojson", source: "foursquare", classify: classifyFoursquare },
	{ file: "poi-osm-point.geojson", source: "osm", classify: classifyOsm },
	{ file: "poi-osm-polygon.geojson", source: "osm", classify: classifyOsm },
	{ file: "poi-overture-point.geojson", source: "overture", classify: classifyOverture },
]

const flattenCoordinates = coordinates => coordinates.flat( Infinity )

const getPolygonCenter = coordinates => {
	const values = flattenCoordinates( coordinates )
	let minimumLongitude = Infinity
	let minimumLatitude = Infinity
	let maximumLongitude = -Infinity
	let maximumLatitude = -Infinity

	for( let index = 0; index < values.length; index += 2 ) {
		const longitude = Number( values[ index ] )
		const latitude = Number( values[ index + 1 ] )

		if( !Number.isFinite( longitude ) || !Number.isFinite( latitude ) ) {
			continue
		}

		minimumLongitude = Math.min( minimumLongitude, longitude )
		minimumLatitude = Math.min( minimumLatitude, latitude )
		maximumLongitude = Math.max( maximumLongitude, longitude )
		maximumLatitude = Math.max( maximumLatitude, latitude )
	}

	if( !Number.isFinite( minimumLongitude ) ) {
		return null
	}

	return [
		( minimumLongitude + maximumLongitude ) / 2,
		( minimumLatitude + maximumLatitude ) / 2,
	]
}

const getPointCoordinates = geometry => {
	if( geometry?.type === "Point" ) {
		return geometry.coordinates
	}
	if( geometry?.type === "Polygon" || geometry?.type === "MultiPolygon" ) {
		return getPolygonCenter( geometry.coordinates )
	}

	return null
}

const normalizeName = name => {
	const value = String( name ?? "" ).trim()
	return value || "Nomsiz fast food"
}

const getSubtype = ( name, categories ) => {
	const value = `${ name } ${ categories.join( " " ) }`.toLocaleLowerCase()

	if( /burger/.test( value ) ) {
		return "burger"
	}
	if( /pizza|pizzeria/.test( value ) ) {
		return "pizza"
	}
	if( /chicken|wings/.test( value ) ) {
		return "chicken"
	}
	if( /doner|kebab|shawarma|shaorma|shaurma|lavash/.test( value ) ) {
		return "doner_kebab"
	}
	if( /sandwich|sendvich/.test( value ) ) {
		return "sandwich"
	}
	if( /hot.?dog/.test( value ) ) {
		return "hot_dog"
	}
	if( /food.?truck|food.?stand/.test( value ) ) {
		return "street_food"
	}
	if( /food.?court/.test( value ) ) {
		return "food_court"
	}

	return "general_fast_food"
}

const sourceAdapters = {
	foursquare: properties => ( {
		id: properties.place_id,
		name: properties.name,
		categories: [ properties.cat_name, properties.cat2_name, properties.cat3_name ].filter( Boolean ),
		confidence: null,
		address: properties.addr,
	} ),
	osm: properties => ( {
		id: `${ properties.OSM_TYPE }:${ properties.OSM_ID }`,
		name: properties.NAME ?? properties.NAME_EN,
		categories: [ properties.AMENITY ].filter( Boolean ),
		confidence: null,
		address: null,
	} ),
	overture: properties => ( {
		id: properties.id,
		name: properties.names_pri ?? properties.names_com,
		categories: [ properties.categories?.primary, ...( properties.categories?.alternate ?? [] ) ].filter( Boolean ),
		confidence: Number.isFinite( Number( properties.confidence ) ) ? Number( properties.confidence ) : null,
		address: properties.addresses?.[ 0 ]?.freeform ?? null,
	} ),
}

const normalizedFeatures = new Map()
const summary = {}

for( const source of sources ) {
	const collection = JSON.parse( await readFile( path.join( poiDirectory, source.file ), "utf8" ) )
	let added = 0
	let merged = 0
	let invalidGeometry = 0

	for( const feature of collection.features ?? [] ) {
		if( source.classify( feature.properties ?? {} ).type !== "direct" ) {
			continue
		}

		const coordinates = getPointCoordinates( feature.geometry )

		if( !coordinates ) {
			invalidGeometry++
			continue
		}

		const adapted = sourceAdapters[ source.source ]( feature.properties ?? {} )
		const name = normalizeName( adapted.name )
		const id = `${ source.source }:${ adapted.id }`
		const existingFeature = normalizedFeatures.get( id )

		if( existingFeature ) {
			const categories = [ ...new Set( [ ...existingFeature.properties.originalCategories, ...adapted.categories ] ) ]
			existingFeature.properties.originalCategories = categories
			existingFeature.properties.subtype = getSubtype( name, categories )
			merged++
			continue
		}

		normalizedFeatures.set( id, {
			type: "Feature",
			geometry: { type: "Point", coordinates },
			properties: {
				id,
				source: source.source,
				sourceId: adapted.id,
				name,
				subtype: getSubtype( name, adapted.categories ),
				originalCategories: adapted.categories,
				confidence: adapted.confidence,
				address: adapted.address,
				originalGeometry: feature.geometry?.type ?? null,
			},
		} )
		added++
	}

	summary[ source.file ] = { added, merged, invalidGeometry }
}

const features = [ ...normalizedFeatures.values() ]

const output = {
	type: "FeatureCollection",
	metadata: {
		generatedAt: new Date().toISOString(),
		featureCount: features.length,
		deduplicated: false,
	},
	features,
}

await mkdir( outputDirectory, { recursive: true } )
await writeFile( outputFile, `${ JSON.stringify( output ) }\n` )

console.log( `Normalized ${ features.length } direct fast-food features.` )
console.table( summary )
console.log( `Output: ${ path.relative( rootDirectory, outputFile ) }` )
