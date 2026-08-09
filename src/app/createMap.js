import "mapbox-gl/dist/mapbox-gl.css"
import mapboxgl from "mapbox-gl"

window.mapboxgl = mapboxgl

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

export function createMap() {

	return new Promise( ( resolve, reject ) => {

		try {

			const map = new mapboxgl.Map( {
				container: "map",
				center: [ 69.2758, 41.2826 ],
				zoom: 10,
				maxZoom: 18,
				hash: true,
				doubleClickZoom: false,
				projection: "mercator",
				attributionControl: null,
				logoPosition: "bottom-right",
			} )

			map.on( "style.load", () => {

				map.setConfigProperty( "basemap", "theme", "faded" )
				map.setConfigProperty( "basemap", "lightPreset", "night" )
			} )

			const container = map.getCanvasContainer()
			container.style.cursor = "default"

			const onInitialError = event => reject( event.error )

			map.once( "error", onInitialError )

			map.on( "load", () => {

				map.off( "error", onInitialError )

				resolve( map )
			} )
		}
		catch( error ) {

			reject( error )
		}
	} )
}
