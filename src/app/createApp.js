import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
	ChevronDown,
	Compass,
	FileText,
	HelpCircle,
	Layers3,
	LocateFixed,
	MapPin,
	Minus,
	Plus,
	Search,
	Settings,
	Store,
	Target,
	UserRound,
	X,
	createIcons,
} from "lucide"

const workflows = {
	analyze: {
		label: "Joyni tahlil qilish",
		title: "Lokatsiyani belgilang",
		description: "Xaritadan fast food ochmoqchi bo‘lgan aniq nuqtani tanlang.",
		action: "Tahlilni boshlash",
	},
	find: {
		label: "Joylarni topish",
		title: "Qidiruv markazini belgilang",
		description: "Eng yaxshi lokatsiyalar qidiriladigan hudud markazini tanlang.",
		action: "Lokatsiyalarni topish",
	},
}

const navItems = [
	[ "explore", "compass", "Explore" ],
	[ "analyze", "map-pin", "Tahlil" ],
	[ "find", "search", "Joy topish" ],
	[ "reports", "file-text", "Hisobotlar" ],
	[ "compare", "arrow-left-right", "Taqqoslash" ],
	[ "layers", "layers-3", "Data qatlamlari" ],
]

const circleFeature = ( point, radius ) => {
	const coordinates = []
	const latitudeScale = radius / 111320
	const longitudeScale = latitudeScale / Math.cos( point.lat * Math.PI / 180 )

	for( let index = 0; index <= 64; index++ ) {
		const angle = index / 64 * Math.PI * 2
		coordinates.push( [ point.lng + Math.cos( angle ) * longitudeScale, point.lat + Math.sin( angle ) * latitudeScale ] )
	}

	return { type: "Feature", geometry: { type: "Polygon", coordinates: [ coordinates ] } }
}

export function createApp() {
	const root = document.querySelector( "#root" )
	const navigation = navItems.map( ( [ id, icon, label ] ) => `
		<button class="nav-item ${ id === "explore" ? "is-active" : "" }" type="button" data-view="${ id }">
			<span><i data-lucide="${ icon }"></i></span><b>${ label }</b>
		</button>
	` ).join( "" )

	root.insertAdjacentHTML( "beforeend", `
		<header class="topbar">
			<a class="brand" href="#" aria-label="Ummon Location"><span class="brand-mark"><img src="/logo.png" alt=""></span><span><strong>Ummon</strong><small>Location Intelligence</small></span></a>
			<button class="city-selector" type="button"><i class="status-dot"></i>Toshkent <i data-lucide="chevron-down"></i></button>
			<div class="map-search"><span><i data-lucide="search"></i></span><input type="search" placeholder="Manzil yoki hududni qidiring" aria-label="Manzil qidirish"><kbd>⌘ K</kbd></div>
			<div class="top-actions"><button type="button" aria-label="Yordam"><i data-lucide="help-circle"></i></button><button type="button" aria-label="Profil"><i data-lucide="user-round"></i></button></div>
		</header>

		<aside class="sidebar">
			<span class="nav-label">Workspace</span>
			<nav>${ navigation }</nav>
			<div class="sidebar-bottom">
				<span class="system-status"><i></i><b>Data holati</b><small>OSM · Mapbox</small></span>
				<button class="nav-item" type="button" data-view="settings"><span><i data-lucide="settings"></i></span><b>Sozlamalar</b></button>
			</div>
		</aside>

		<main class="map-workspace">
			<section class="workflow-panel is-hidden" data-panel="workflow">
				<div class="panel-top"><button class="back-button" type="button"><i data-lucide="arrow-left"></i></button><div><span class="eyebrow">YANGI TAHLIL</span><h2 id="workflow-title">Lokatsiyani belgilang</h2></div><button class="close-button" type="button"><i data-lucide="x"></i></button></div>
				<p id="workflow-description">Xaritadan fast food ochmoqchi bo‘lgan aniq nuqtani tanlang.</p>
				<div class="step"><span>1</span><div><small>NUQTA</small><strong id="selected-location">Xaritani bosing</strong></div></div>
				<fieldset><legend>2 &nbsp; Tahlil radiusi</legend><div class="segments" data-control="radius"><button type="button" data-value="500">500 m</button><button class="is-active" type="button" data-value="1000">1 km</button><button type="button" data-value="2000">2 km</button></div></fieldset>
				<fieldset><legend>3 &nbsp; Fast food formati</legend><label class="select-wrap"><span><i data-lucide="store"></i></span><select><option>Universal fast food</option><option>Student / budget</option><option>Family fast food</option><option>Delivery-first</option><option>Roadside</option></select></label></fieldset>
				<button class="primary-action" id="primary-action" type="button" disabled><span>Tahlilni boshlash</span><b><i data-lucide="arrow-right"></i></b></button>
			</section>

			<section class="report-panel is-hidden" data-panel="report">
				<div class="report-head"><div><span class="eyebrow">LOCATION REPORT</span><h2 id="report-title">Fast Food Fit</h2><small id="report-location">Tanlangan lokatsiya</small></div><button class="close-report" type="button"><i data-lucide="x"></i></button></div>
				<div class="score-block"><div class="score-ring"><strong>—</strong><small>/100</small></div><div><span>AI LOCATION SCORE</span><strong>Hisoblashga tayyor</strong><p>Real geo-data ulanganda shu yerda rating chiqadi.</p></div></div>
				<div class="metric-grid"><article><span>Talab</span><strong>—</strong></article><article><span>Raqobat</span><strong>—</strong></article><article><span>Transport</span><strong>—</strong></article><article><span>Delivery</span><strong>—</strong></article></div>
				<div class="report-section"><div><h3>Asosiy signallar</h3><span>500 m · 1 km · 2 km</span></div><div class="signal-list"><p><i></i>Metro va jamoat transporti <b>—</b></p><p><i></i>Fast food raqobatchilari <b>—</b></p><p><i></i>Auditoriya obyektlari <b>—</b></p></div></div>
				<div class="report-section"><div><h3>AI xulosasi</h3></div><div class="empty-insight">Geo-data tahlilidan keyin kuchli tomonlar, xavflar va tavsiya shu yerda paydo bo‘ladi.</div></div>
			</section>

			<section class="page-panel is-hidden" data-panel="page">
				<button class="close-page" type="button"><i data-lucide="x"></i></button><span class="eyebrow" id="page-eyebrow">WORKSPACE</span><h2 id="page-title">Hisobotlar</h2><p id="page-description"></p><div id="page-content"></div>
			</section>

			<div class="map-hint is-hidden"><span><i data-lucide="locate-fixed"></i></span> Xaritadan nuqtani tanlang</div>
			<div class="map-tools"><button type="button" data-map-action="in" aria-label="Xaritani kattalashtirish"><i data-lucide="plus"></i></button><button type="button" data-map-action="out" aria-label="Xaritani kichraytirish"><i data-lucide="minus"></i></button></div>
		</main>
	` )

	createIcons( {
		icons: { ArrowLeft, ArrowLeftRight, ArrowRight, ChevronDown, Compass, FileText, HelpCircle, Layers3, LocateFixed, MapPin, Minus, Plus, Search, Settings, Store, Target, UserRound, X },
		attrs: { "stroke-width": 1.8 },
	} )

	let map
	let marker
	let radius = 1000
	let selectedPoint
	let activeWorkflow
	let isSelecting = false

	const get = selector => root.querySelector( selector )
	const workflow = get( "[data-panel='workflow']" )
	const report = get( "[data-panel='report']" )
	const page = get( "[data-panel='page']" )
	const hint = get( ".map-hint" )
	const action = get( "#primary-action" )
	let poiLayerLoaded = false

	const hidePanels = () => [ workflow, report, page ].forEach( panel => panel.classList.add( "is-hidden" ) )
	const setActiveNav = view => root.querySelectorAll( ".nav-item" ).forEach( item => item.classList.toggle( "is-active", item.dataset.view === view ) )

	const clearSelection = () => {
		selectedPoint = null
		isSelecting = false
		action.disabled = true
		get( "#selected-location" ).textContent = "Xaritani bosing"
		hint.classList.add( "is-hidden" )
		if( marker ) {
			marker.remove()
			marker = null
		}
		if( map?.getSource( "selection-radius" ) ) {
			map.getSource( "selection-radius" ).setData( { type: "FeatureCollection", features: [] } )
		}
	}

	const selectLocation = point => {
		selectedPoint = point
		get( "#selected-location" ).textContent = `${ point.lat.toFixed( 5 ) }, ${ point.lng.toFixed( 5 ) }`
		action.disabled = false
		hint.classList.add( "is-hidden" )
		if( marker ) {
			marker.remove()
		}
		marker = new window.mapboxgl.Marker( { color: "#2388ff" } ).setLngLat( point ).addTo( map )
		updateRadius()
	}

	const startWorkflow = mode => {
		activeWorkflow = mode
		const copy = workflows[ mode ]
		hidePanels()
		workflow.classList.remove( "is-hidden" )
		get( "#workflow-title" ).textContent = copy.title
		get( "#workflow-description" ).textContent = copy.description
		action.querySelector( "span" ).textContent = copy.action
		clearSelection()
		isSelecting = true
		hint.classList.remove( "is-hidden" )
		setActiveNav( mode )
		if( poiLayerLoaded ) {
			setPoiLayerVisibility( "none" )
		}
	}

	const showExplore = async() => {
		hidePanels()
		clearSelection()
		setActiveNav( "explore" )
		if( map ) {
			if( !poiLayerLoaded ) {
				await loadPoiLayer()
			}
			else {
				setPoiLayerVisibility( "visible" )
			}
		}
	}

	const pageData = {
		reports: [ "HISOBOTLAR", "Mening hisobotlarim", "Saqlangan lokatsiya tahlillari shu yerda jamlanadi.", "Hali hisobot yo‘q", "Birinchi lokatsiyani tahlil qilganingizdan so‘ng hisobot shu yerda ko‘rinadi." ],
		compare: [ "SOLISHTIRISH", "Lokatsiyalarni taqqoslash", "Ikki yoki undan ortiq lokatsiyaning biznes signallarini yonma-yon solishtiring.", "Taqqoslash ro‘yxati bo‘sh", "Hisobotlardan lokatsiyalarni tanlab bu yerga qo‘shish mumkin bo‘ladi." ],
		layers: [ "GEO-DATA", "Data qatlamlari", "Tahlilda qatnashadigan ochiq ma’lumotlar va ularning holati.", "7 ta signal qatlami", "Transport, raqobat, auditoriya, talab, yo‘l, delivery va qulaylik ma’lumotlari." ],
		settings: [ "SOZLAMALAR", "Mahsulot sozlamalari", "Standart radius, til va xarita ko‘rinishini boshqaring.", "Sozlamalar tez orada", "MVP davomida asosiy parametrlar shu bo‘limga qo‘shiladi." ],
	}

	const showPage = view => {
		const data = pageData[ view ]
		hidePanels()
		page.classList.remove( "is-hidden" )
		get( "#page-eyebrow" ).textContent = data[ 0 ]
		get( "#page-title" ).textContent = data[ 1 ]
		get( "#page-description" ).textContent = data[ 2 ]
		get( "#page-content" ).innerHTML = `<div class="empty-state"><span><i data-lucide="target"></i></span><strong>${ data[ 3 ] }</strong><p>${ data[ 4 ] }</p></div>`
		createIcons( { icons: { Target }, attrs: { "stroke-width": 1.8 } } )
		clearSelection()
		setActiveNav( view )
		if( poiLayerLoaded ) {
			setPoiLayerVisibility( "none" )
		}
	}

	const updateRadius = () => {
		if( map && selectedPoint && map.getSource( "selection-radius" ) ) {
			map.getSource( "selection-radius" ).setData( circleFeature( selectedPoint, radius ) )
		}
	}

	const setPoiLayerVisibility = visibility => {
		[ "fast-food-heatmap", "fast-food-point-glow", "fast-food-points" ].forEach( layerId => {
			if( map.getLayer( layerId ) ) {
				map.setLayoutProperty( layerId, "visibility", visibility )
			}
		} )
	}

	const loadPoiLayer = async() => {
		try {
			const response = await fetch( "/data/fast-food-final.geojson" )
			if( !response.ok ) {
				throw new Error( `POI data request failed: ${ response.status }` )
			}

			const data = await response.json()
			map.addSource( "fast-food-poi", {
				type: "geojson",
				data,
			} )
			map.addLayer( {
				id: "fast-food-heatmap",
				type: "heatmap",
				source: "fast-food-poi",
				maxzoom: 14,
				paint: {
					"heatmap-weight": [ "interpolate", [ "linear" ], [ "get", "confidence" ], 0.5, 0.3, 1, 0.75 ],
					"heatmap-intensity": [ "interpolate", [ "linear" ], [ "zoom" ], 8, 0.4, 13, 1.05 ],
					"heatmap-color": [
						"interpolate", [ "linear" ], [ "heatmap-density" ],
						0, "rgba(3, 10, 24, 0)",
						0.2, "rgba(24, 83, 180, 0.18)",
						0.45, "rgba(20, 118, 255, 0.38)",
						0.7, "rgba(31, 183, 255, 0.56)",
						0.88, "rgba(97, 218, 255, 0.68)",
						1, "rgba(221, 247, 255, 0.78)",
					],
					"heatmap-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 8, 11, 13, 25 ],
					"heatmap-opacity": [ "interpolate", [ "linear" ], [ "zoom" ], 8, 0.82, 11, 0.78, 14, 0 ],
				},
			} )
			map.addLayer( {
				id: "fast-food-point-glow",
				type: "circle",
				source: "fast-food-poi",
				minzoom: 11,
				paint: {
					"circle-color": "#168cff",
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 11, 7, 15, 15 ],
					"circle-blur": 0.8,
					"circle-opacity": [ "interpolate", [ "linear" ], [ "zoom" ], 11, 0, 12.5, 0.42, 16, 0.28 ],
					"circle-emissive-strength": 2,
				},
			} )
			map.addLayer( {
				id: "fast-food-points",
				type: "circle",
				source: "fast-food-poi",
				minzoom: 11.5,
				paint: {
					"circle-color": [ "interpolate", [ "linear" ], [ "get", "confidence" ], 0.5, "#1d6ed8", 0.75, "#28a9ff", 1, "#8be3ff" ],
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 11.5, 4.5, 15, 8.5 ],
					"circle-opacity": [ "interpolate", [ "linear" ], [ "zoom" ], 11.5, 0, 13, 0.9 ],
					"circle-stroke-color": "#07101f",
					"circle-stroke-width": [ "interpolate", [ "linear" ], [ "zoom" ], 12, 1, 15, 2 ],
					"circle-emissive-strength": 1.6,
				},
			} )

			map.on( "click", "fast-food-points", event => {
				const properties = event.features[ 0 ].properties
				const confidence = Math.round( Number( properties.confidence ) * 100 )
				const coordinates = [ ...event.features[ 0 ].geometry.coordinates ]
				const content = document.createElement( "div" )
				const header = document.createElement( "div" )
				const label = document.createElement( "span" )
				const name = document.createElement( "strong" )
				const details = document.createElement( "small" )
				const meta = document.createElement( "div" )
				const coordinate = document.createElement( "p" )
				const analyzeButton = document.createElement( "button" )
				header.className = "poi-popup__header"
				label.className = "poi-popup__label"
				name.className = "poi-popup__name"
				details.className = "poi-popup__type"
				meta.className = "poi-popup__meta"
				coordinate.className = "poi-popup__coordinate"
				analyzeButton.className = "poi-popup__action"
				label.textContent = "Fast food nuqtasi"
				name.textContent = properties.name || "Nomsiz fast food"
				details.textContent = properties.subtype.replaceAll( "_", " " )
				meta.textContent = `Ma’lumot ishonchliligi: ${ confidence }%`
				coordinate.textContent = `${ coordinates[ 1 ].toFixed( 5 ) }, ${ coordinates[ 0 ].toFixed( 5 ) }`
				analyzeButton.textContent = "Shu lokatsiyani tahlil qilish"
				header.append( label, details )
				content.append( header, name, meta, coordinate, analyzeButton )

				const popup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 18, maxWidth: "340px", className: "poi-popup" } )
					.setLngLat( coordinates )
					.setDOMContent( content )
					.addTo( map )
				analyzeButton.addEventListener( "click", () => {
					popup.remove()
					startWorkflow( "analyze" )
					selectLocation( { lng: coordinates[ 0 ], lat: coordinates[ 1 ] } )
				} )
			} )
			map.on( "mouseenter", "fast-food-points", () => map.getCanvas().style.cursor = "pointer" )
			map.on( "mouseleave", "fast-food-points", () => map.getCanvas().style.cursor = "default" )
			poiLayerLoaded = true
			setPoiLayerVisibility( "visible" )
		}
		catch( error ) {
			console.error( error )
		}
	}

	window.addEventListener( "ummon:map-ready", event => {
		map = event.detail
		map.addSource( "selection-radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } } )
		map.addLayer( { id: "selection-radius-fill", type: "fill", source: "selection-radius", paint: { "fill-color": "#2388ff", "fill-opacity": 0.14, "fill-emissive-strength": 0.65 } } )
		map.addLayer( { id: "selection-radius-glow", type: "line", source: "selection-radius", paint: { "line-color": "#168cff", "line-width": 10, "line-blur": 7, "line-opacity": 0.7, "line-emissive-strength": 2.4 } } )
		map.addLayer( { id: "selection-radius-line", type: "line", source: "selection-radius", paint: { "line-color": "#8bd8ff", "line-width": 3, "line-emissive-strength": 1.8 } } )
		map.on( "click", event => {
			if( !isSelecting ) {
				return
			}
			selectLocation( event.lngLat )
		} )
		loadPoiLayer()
	} )

	root.querySelectorAll( ".nav-item" ).forEach( button => button.addEventListener( "click", () => {
		if( button.dataset.view === "explore" ) {
			showExplore()
		}
		else if( [ "analyze", "find" ].includes( button.dataset.view ) ) {
			startWorkflow( button.dataset.view )
		}
		else {
			showPage( button.dataset.view )
		}
	} ) )
	get( ".back-button" ).addEventListener( "click", showExplore )
	get( ".close-button" ).addEventListener( "click", showExplore )
	get( ".close-report" ).addEventListener( "click", showExplore )
	get( ".close-page" ).addEventListener( "click", showExplore )

	root.querySelectorAll( "[data-control='radius'] button" ).forEach( button => button.addEventListener( "click", () => {
		radius = Number( button.dataset.value )
		root.querySelectorAll( "[data-control='radius'] button" ).forEach( item => item.classList.toggle( "is-active", item === button ) )
		updateRadius()
	} ) )

	root.querySelectorAll( "[data-map-action]" ).forEach( button => button.addEventListener( "click", () => {
		if( map ) {
			map[ button.dataset.mapAction === "in" ? "zoomIn" : "zoomOut" ]()
		}
	} ) )

	action.addEventListener( "click", () => {
		isSelecting = false
		hidePanels()
		report.classList.remove( "is-hidden" )
		get( "#report-title" ).textContent = activeWorkflow === "find" ? "Top lokatsiyalar" : "Fast Food Fit"
		get( "#report-location" ).textContent = `${ selectedPoint.lat.toFixed( 5 ) }, ${ selectedPoint.lng.toFixed( 5 ) } · ${ radius / 1000 } km`
	} )
}
