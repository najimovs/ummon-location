import "@css/main.css"
import { createMap } from "@app/createMap"
import { createApp } from "@app/createApp"

createApp()

createMap()
	.then( map => window.dispatchEvent( new CustomEvent( "ummon:map-ready", { detail: map } ) ) )
	.catch( () => window.dispatchEvent( new CustomEvent( "ummon:map-error" ) ) )
