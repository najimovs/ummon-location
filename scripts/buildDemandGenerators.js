import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const poiDirectory = path.join( rootDirectory, "public/poi" )
const outputDirectory = path.join( rootDirectory, "public/data" )
const outputFile = path.join( outputDirectory, "demand-generators.geojson" )
const metadataFile = path.join( outputDirectory, "demand-generators-metadata.json" )

const sources = [
	{ file: "poi-fsq-point.geojson", source: "foursquare" },
	{ file: "poi-osm-point.geojson", source: "osm" },
	{ file: "poi-osm-polygon.geojson", source: "osm" },
	{ file: "poi-overture-point.geojson", source: "overture" },
]

const categoryDefinitions = [
	{ id: "education", audience: "students", weight: 1, pattern: /college|university|academic|student center|higher_education|universit|institut/ },
	{ id: "education", audience: "students", weight: 0.58, pattern: /school|education|academy|lyceum|litsey|maktab/ },
	{ id: "retail", audience: "shoppers", weight: 0.9, pattern: /shopping mall|shopping_mall|marketplace|department store|department_store|market(?!ing)|bazaar|bozor/ },
	{ id: "retail", audience: "shoppers", weight: 0.7, pattern: /supermarket|hypermarket|superstore|big box store|big_box_store/ },
	{ id: "transport", audience: "commuters", weight: 0.9, pattern: /bus station|bus_station|train station|train_station|railway station|airport|transport hub/ },
	{ id: "office", audience: "workers", weight: 0.82, pattern: /business center|business_center|coworking|office/ },
	{ id: "office", audience: "workers", weight: 0.66, pattern: /government building|government_building|townhall|courthouse/ },
	{ id: "healthcare", audience: "visitors", weight: 0.7, pattern: /hospital|medical center|medical_center|clinic|polyclinic|maternity/ },
	{ id: "leisure", audience: "visitors", weight: 0.72, pattern: /stadium|arena|movie theater|cinema|theme park|theme_park|amusement|zoo/ },
	{ id: "leisure", audience: "visitors", weight: 0.52, pattern: /museum|(?:^|[ _>])park(?:$|[ _>])|theatre|theater|performing arts|concert hall/ },
	{ id: "hotel", audience: "travelers", weight: 0.55, pattern: /hotel|hostel|lodging|accommodation/ },
]

const labels = {
	education: "Ta’lim",
	retail: "Savdo",
	transport: "Transport",
	office: "Ofis",
	healthcare: "Tibbiyot",
	leisure: "Hordiq",
	hotel: "Mehmonxona",
}

const flattenCoordinates = coordinates => coordinates.flat( Infinity )
const getPointCoordinates = geometry => {
	if( geometry?.type === "Point" ) {
		return geometry.coordinates
	}
	if( geometry?.type !== "Polygon" && geometry?.type !== "MultiPolygon" ) {
		return null
	}
	const values = flattenCoordinates( geometry.coordinates )
	let minimumLongitude = Infinity
	let minimumLatitude = Infinity
	let maximumLongitude = -Infinity
	let maximumLatitude = -Infinity
	for( let index = 0; index < values.length; index += 2 ) {
		const longitude = Number( values[ index ] )
		const latitude = Number( values[ index + 1 ] )
		if( Number.isFinite( longitude ) && Number.isFinite( latitude ) ) {
			minimumLongitude = Math.min( minimumLongitude, longitude )
			minimumLatitude = Math.min( minimumLatitude, latitude )
			maximumLongitude = Math.max( maximumLongitude, longitude )
			maximumLatitude = Math.max( maximumLatitude, latitude )
		}
	}
	return Number.isFinite( minimumLongitude )
		? [ ( minimumLongitude + maximumLongitude ) / 2, ( minimumLatitude + maximumLatitude ) / 2 ]
		: null
}

const adaptProperties = {
	foursquare: properties => ( {
		id: properties.place_id,
		name: properties.name,
		categoryText: [ properties.cat_label, properties.cat_name, properties.cat1_name, properties.cat2_name, properties.cat3_name ].filter( Boolean ).join( " " ),
		originalCategory: properties.cat_label || properties.cat_name,
		confidence: null,
	} ),
	osm: properties => ( {
		id: `${ properties.OSM_TYPE }:${ properties.OSM_ID }`,
		name: properties.NAME || properties.NAME_EN,
		categoryText: [ properties.AMENITY, properties.SHOP, properties.OFFICE, properties.TOURISM, properties.LEISURE, properties.SPORT ].filter( Boolean ).join( " " ),
		originalCategory: [ properties.AMENITY, properties.SHOP, properties.OFFICE, properties.TOURISM, properties.LEISURE ].find( Boolean ),
		confidence: null,
	} ),
	overture: properties => ( {
		id: properties.id,
		name: properties.names_pri || properties.names_com,
		categoryText: [ properties.categories?.primary, ...( properties.categories?.alternate || [] ), properties.basic_cat, ...( properties.taxonomy?.hierarchy || [] ) ].filter( Boolean ).join( " " ),
		originalCategory: properties.categories?.primary || properties.basic_cat,
		confidence: Number.isFinite( Number( properties.confidence ) ) ? Number( properties.confidence ) : null,
	} ),
}

const classify = categoryText => {
	const normalized = String( categoryText || "" ).toLocaleLowerCase()
	if( /metro station|subway|metro_station|parking|parking_lot|nursery|preschool|day care|day_care/.test( normalized ) ) {
		return null
	}
	return categoryDefinitions.find( definition => definition.pattern.test( normalized ) ) || null
}

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

const normalized = []
const sourceSummary = {}
for( const source of sources ) {
	const collection = JSON.parse( await readFile( path.join( poiDirectory, source.file ), "utf8" ) )
	let selected = 0
	for( const feature of collection.features || [] ) {
		const coordinates = getPointCoordinates( feature.geometry )
		const adapted = adaptProperties[ source.source ]( feature.properties || {} )
		const classification = classify( adapted.categoryText )
		if( !coordinates || !classification ) {
			continue
		}
		const name = String( adapted.name || `Nomsiz ${ labels[ classification.id ].toLocaleLowerCase() } obyekti` ).trim()
		normalized.push( {
			type: "Feature",
			geometry: { type: "Point", coordinates },
			properties: {
				source: source.source,
				sourceId: adapted.id,
				name,
				normalizedName: normalizeName( name ),
				category: classification.id,
				categoryLabel: labels[ classification.id ],
				audience: classification.audience,
				weight: classification.weight,
				originalCategory: adapted.originalCategory || null,
				confidence: adapted.confidence,
			},
		} )
		selected++
	}
	sourceSummary[ source.file ] = selected
}

const parent = normalized.map( ( _, index ) => index )
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
const cells = new Map()
const cellSize = 0.001
normalized.forEach( ( feature, index ) => {
	const [ longitude, latitude ] = feature.geometry.coordinates
	const longitudeCell = Math.floor( longitude / cellSize )
	const latitudeCell = Math.floor( latitude / cellSize )
	for( let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++ ) {
		for( let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++ ) {
			for( const candidateIndex of cells.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) || [] ) {
				const candidate = normalized[ candidateIndex ]
				const sameCategory = feature.properties.category === candidate.properties.category
				const sameName = feature.properties.normalizedName && feature.properties.normalizedName === candidate.properties.normalizedName
				const distance = distanceMeters( feature.geometry.coordinates, candidate.geometry.coordinates )
				if( sameCategory && ( ( sameName && distance <= 100 ) || distance <= 12 ) ) {
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
normalized.forEach( ( feature, index ) => {
	const root = find( index )
	const group = groups.get( root ) || []
	group.push( feature )
	groups.set( root, group )
} )

const features = [ ...groups.values() ].map( group => {
	const primary = [ ...group ].sort( ( first, second ) => {
		const score = feature => ( feature.properties.name.startsWith( "Nomsiz" ) ? 0 : 2 ) + ( feature.properties.source === "osm" ? 0.4 : 0 ) + ( feature.properties.confidence || 0 )
		return score( second ) - score( first )
	} )[ 0 ]
	const sourcesInGroup = [ ...new Set( group.map( feature => feature.properties.source ) ) ].sort()
	const id = createHash( "sha256" ).update( group.map( feature => `${ feature.properties.source}:${ feature.properties.sourceId }` ).sort().join( "|" ) ).digest( "hex" ).slice( 0, 16 )
	return {
		type: "Feature",
		geometry: primary.geometry,
		properties: {
			id: `demand_${ id }`,
			name: primary.properties.name,
			category: primary.properties.category,
			categoryLabel: primary.properties.categoryLabel,
			audience: primary.properties.audience,
			weight: Math.max( ...group.map( feature => feature.properties.weight ) ),
			confidence: Number( Math.min( 0.98, 0.58 + ( sourcesInGroup.length - 1 ) * 0.18 + Math.max( ...group.map( feature => feature.properties.confidence || 0 ) ) * 0.18 ).toFixed( 3 ) ),
			sources: sourcesInGroup,
			originalCategory: primary.properties.originalCategory,
		},
	}
} ).sort( ( first, second ) => first.properties.category.localeCompare( second.properties.category ) || first.properties.name.localeCompare( second.properties.name ) )

const countsByCategory = Object.fromEntries( Object.keys( labels ).map( category => [ category, features.filter( feature => feature.properties.category === category ).length ] ) )
const generatedAt = new Date().toISOString()
await mkdir( outputDirectory, { recursive: true } )
await writeFile( outputFile, `${ JSON.stringify( { type: "FeatureCollection", metadata: { generatedAt, featureCount: features.length, countsByCategory }, features } ) }\n` )
await writeFile( metadataFile, `${ JSON.stringify( { generatedAt, featureCount: features.length, normalizedCount: normalized.length, removedDuplicates: normalized.length - features.length, countsByCategory, sourceSummary }, null, 2 ) }\n` )

console.log( `Demand generators: ${ features.length } features (${ normalized.length - features.length } duplicates merged)` )
console.table( countsByCategory )
