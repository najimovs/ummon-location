import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const poiDirectory = path.join( rootDirectory, "public/poi" )
const outputDirectory = path.join( rootDirectory, "data" )
const outputFile = path.join( outputDirectory, "poi-inventory.json" )
const valueLimit = 2000
const sampleLimit = 20

const files = ( await readdir( poiDirectory ) )
	.filter( file => file.endsWith( ".geojson" ) && file !== "order_boundary.geojson" )
	.sort()

const addValue = ( inventory, key, value ) => {
	if( value === null || value === undefined || value === "" ) {
		return
	}

	if( Array.isArray( value ) ) {
		value.forEach( item => addValue( inventory, key, item ) )
		return
	}

	if( typeof value === "object" ) {
		Object.entries( value ).forEach( ( [ nestedKey, nestedValue ] ) => {
			addValue( inventory, `${ key }.${ nestedKey }`, nestedValue )
		} )
		return
	}

	const normalizedValue = String( value )
	const entry = inventory.get( key ) ?? {
		count: 0,
		values: new Map(),
		truncated: false,
	}

	entry.count++

	if( entry.values.has( normalizedValue ) ) {
		entry.values.set( normalizedValue, entry.values.get( normalizedValue ) + 1 )
	}
	else if( entry.values.size < valueLimit ) {
		entry.values.set( normalizedValue, 1 )
	}
	else {
		entry.truncated = true
	}

	inventory.set( key, entry )
}

const serializeInventory = inventory => Object.fromEntries(
	[ ...inventory.entries() ]
		.sort( ( [ firstKey ], [ secondKey ] ) => firstKey.localeCompare( secondKey ) )
		.map( ( [ key, entry ] ) => {
			const sortedValues = [ ...entry.values.entries() ]
				.sort( ( first, second ) => second[ 1 ] - first[ 1 ] || first[ 0 ].localeCompare( second[ 0 ] ) )
			const isComplete = !entry.truncated

			return [ key, {
				count: entry.count,
				uniqueValues: isComplete ? sortedValues.length : `${ valueLimit }+`,
				truncated: entry.truncated,
				values: ( isComplete ? sortedValues : sortedValues.slice( 0, sampleLimit ) )
					.map( ( [ value, count ] ) => ( { value, count } ) ),
			} ]
		} )
)

const result = {
	generatedAt: new Date().toISOString(),
	valueLimit,
	sources: {},
	combined: {},
}

const combinedInventory = new Map()

for( const file of files ) {
	const source = JSON.parse( await readFile( path.join( poiDirectory, file ), "utf8" ) )
	const inventory = new Map()
	const geometryTypes = new Set()

	for( const feature of source.features ?? [] ) {
		geometryTypes.add( feature.geometry?.type ?? "Unknown" )

		for( const [ key, value ] of Object.entries( feature.properties ?? {} ) ) {
			addValue( inventory, key, value )
			addValue( combinedInventory, key, value )
		}
	}

	result.sources[ file ] = {
		featureCount: source.features?.length ?? 0,
		geometryTypes: [ ...geometryTypes ].sort(),
		properties: serializeInventory( inventory ),
	}
}

result.combined = serializeInventory( combinedInventory )

await mkdir( outputDirectory, { recursive: true } )
await writeFile( outputFile, `${ JSON.stringify( result, null, "\t" ) }\n` )

const categoryKeyPattern = /amenity|categor|cat[1-6]?_(?:name|label)|basic_cat|taxonomy|shop|office|tourism|leisure|sport/i
const categoryKeys = Object.keys( result.combined ).filter( key => categoryKeyPattern.test( key ) )

console.log( `Analyzed ${ files.length } collections.` )
console.log( `Inventory written to ${ path.relative( rootDirectory, outputFile ) }.` )
console.log( `Found ${ Object.keys( result.combined ).length } property paths and ${ categoryKeys.length } category-related paths.` )
console.log( `Category paths: ${ categoryKeys.join( ", " ) }` )
