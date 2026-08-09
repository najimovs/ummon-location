import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { classifyFoursquare, classifyOsm, classifyOverture } from "./poi/fastFoodClassification.js"

const rootDirectory = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), ".." )
const poiDirectory = path.join( rootDirectory, "public/poi" )

const sources = [
	{ file: "poi-fsq-point.geojson", classify: classifyFoursquare },
	{ file: "poi-osm-point.geojson", classify: classifyOsm },
	{ file: "poi-osm-polygon.geojson", classify: classifyOsm },
	{ file: "poi-overture-point.geojson", classify: classifyOverture },
]

for( const source of sources ) {
	const collection = JSON.parse( await readFile( path.join( poiDirectory, source.file ), "utf8" ) )
	const summary = { direct: 0, indirect: 0, review: 0, excluded: 0 }
	const reviewExamples = []

	for( const feature of collection.features ?? [] ) {
		const classification = source.classify( feature.properties ?? {} )
		summary[ classification.type ]++

		if( classification.type === "review" && reviewExamples.length < 20 ) {
			reviewExamples.push( {
				name: feature.properties?.name ?? feature.properties?.NAME ?? feature.properties?.names_pri ?? null,
				reason: classification.reason,
			} )
		}
	}

	console.log( `\n${ source.file }` )
	console.table( summary )
	console.log( "Review examples:", reviewExamples )
}
