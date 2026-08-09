import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
	ChevronDown,
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
import { area, bbox, booleanPointInPolygon, circle, featureCollection, intersect, point, voronoi } from "@turf/turf"

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
	[ "analyze", "map-pin", "Tahlil" ],
	[ "find", "search", "Joy topish" ],
	[ "reports", "file-text", "Hisobotlar" ],
	[ "compare", "arrow-left-right", "Taqqoslash" ],
]

const defaultLayerSettings = {
	fastFoodPoints: true,
	fastFoodHeatmap: true,
	serviceAreas: true,
	placeLabels: true,
	roadLabels: true,
	poiLabels: false,
	transitLabels: true,
	objects3d: false,
}

const readLayerSettings = () => {
	try {
		return { ...defaultLayerSettings, ...JSON.parse( localStorage.getItem( "ummon-layer-settings" ) || "{}" ) }
	}
	catch {
		return { ...defaultLayerSettings }
	}
}

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
		<button class="nav-item" type="button" data-view="${ id }">
			<span><i data-lucide="${ icon }"></i></span><b>${ label }</b>
		</button>
	` ).join( "" )

	root.insertAdjacentHTML( "beforeend", `
		<header class="topbar">
			<a class="brand" href="#" aria-label="Ummon Location"><span class="brand-mark"><img src="/logo.png" alt=""></span><span><strong>Ummon</strong><small>Location Intelligence</small></span></a>
			<button class="city-selector" type="button"><i class="status-dot"></i>Toshkent <i data-lucide="chevron-down"></i></button>
			<div class="map-search"><span><i data-lucide="search"></i></span><input type="search" placeholder="Fast food yoki manzilni qidiring" aria-label="Fast food qidirish" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"><kbd>⌘ K</kbd><div class="search-results" id="search-results" role="listbox" hidden></div></div>
			<div class="layer-control">
				<button class="layers-toggle" type="button" aria-expanded="false" aria-controls="layers-panel"><i data-lucide="layers-3"></i><span>Qatlamlar</span></button>
				<section class="layers-panel is-hidden" id="layers-panel" aria-label="Xarita qatlamlari">
					<header><div><span>XARITA SOZLAMALARI</span><strong>Qatlamlar</strong></div><button class="close-layers" type="button" aria-label="Qatlamlarni yopish"><i data-lucide="x"></i></button></header>
					<div class="layer-group"><b>Ummon data</b>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodPoints"><span><i class="layer-dot is-poi"></i><em>Fast-food nuqtalari<small>POI va brand lokatsiyalari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodHeatmap"><span><i class="layer-dot is-heatmap"></i><em>Zichlik heatmap’i<small>Fast-food klasterlari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="serviceAreas"><span><i class="layer-dot is-area"></i><em>Xizmat hududlari<small>Tahlildan keyingi Voronoi</small></em></span><i></i></button>
					</div>
					<div class="layer-group"><b>Asosiy xarita</b>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="placeLabels"><span><em>Joy nomlari<small>Tuman va mahallalar</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="roadLabels"><span><em>Yo‘l nomlari<small>Ko‘cha va magistrallar</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="poiLabels"><span><em>Mapbox POI<small>Standart obyekt belgilari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="transitLabels"><span><em>Transport<small>Metro va bekatlar</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="objects3d"><span><em>3D obyektlar<small>Bino va konstruksiyalar</small></em></span><i></i></button>
					</div>
					<footer>Tanlovlar ushbu qurilmada saqlanadi</footer>
				</section>
			</div>
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
				<div class="report-head"><div><span class="eyebrow">REAL GEO ANALYTICS</span><h2 id="report-title">Raqobat tahlili</h2><small id="report-location">Tanlangan lokatsiya</small></div><button class="close-report" type="button"><i data-lucide="x"></i></button></div>
				<div class="score-block"><div class="score-ring"><strong id="competition-score">—</strong><small>/100</small></div><div><span>RAQOBAT BOSIMI</span><strong id="competition-level">Hisoblanmoqda</strong><p id="competition-summary">Radius ichidagi fast-food nuqtalari asosida.</p></div></div>
				<div class="metric-grid"><article><span>Raqobatchilar</span><strong id="competitor-count">—</strong></article><article><span>Tarmoq brandlari</span><strong id="brand-count">—</strong></article><article><span>Eng yaqin raqib</span><strong id="nearest-distance">—</strong></article><article><span>Dominant brand</span><strong id="dominant-brand">—</strong></article></div>
				<div class="report-section territory-section"><div><h3>Taxminiy xizmat hududi</h3><span>Voronoi modeli</span></div><div class="territory-card"><div class="territory-primary"><span>Yangi lokatsiya maydoni</span><strong id="candidate-area">—</strong><small id="territory-share">Umumiy maydonning —</small></div><div class="territory-stats"><p><span>Tanlangan radius</span><b id="analysis-area">—</b></p><p><span>Raqiblar o‘rtachasi</span><b id="average-area">—</b></p><p><span>Comparison</span><b id="area-comparison">—</b></p></div><div class="territory-bars"><div><span>Yangi nuqta</span><i><em id="candidate-area-bar"></em></i><b id="candidate-area-label">—</b></div><div><span>Raqib o‘rtachasi</span><i><em id="average-area-bar"></em></i><b id="average-area-label">—</b></div></div></div><div class="territory-note" id="territory-insight">Xizmat hududi raqobatchilargacha bo‘lgan to‘g‘ri chiziq masofasi asosida hisoblanadi.</div><div class="territory-explainer"><strong>Bu raqam qanday chiqdi?</strong><ol><li><span>1</span><p><b>Eng yaqin nuqta</b>Hududdagi har bir joy eng yaqin fast-food’ga biriktiriladi.</p></li><li><span>2</span><p><b>Radius bilan kesish</b>Faqat siz tanlagan doira ichidagi maydon qoldiriladi.</p></li><li><span>3</span><p><b>Raqib bilan solishtirish</b>Yangi hudud yaqin raqiblarning o‘rtacha maydoni bilan taqqoslanadi.</p></li></ol></div></div>
				<div class="report-section"><div><h3>Masofa bo‘yicha zichlik</h3><span>Fast food POI</span></div><div class="signal-list"><p><i></i>500 metr ichida <b id="band-500">—</b></p><p><i></i>1 kilometr ichida <b id="band-1000">—</b></p><p><i></i>2 kilometr ichida <b id="band-2000">—</b></p></div></div>
				<div class="report-section"><div><h3>Eng yaqin raqobatchi</h3></div><div class="empty-insight" id="nearest-competitor">Hisoblanmoqda…</div></div>
				<div class="report-section"><div><h3>Tahlil izohi</h3></div><div class="empty-insight" id="competition-insight">Hozircha tahlil faqat fast-food raqobati signaliga asoslanadi.</div></div>
			</section>

			<section class="page-panel is-hidden" data-panel="page">
				<button class="close-page" type="button"><i data-lucide="x"></i></button><span class="eyebrow" id="page-eyebrow">WORKSPACE</span><h2 id="page-title">Hisobotlar</h2><p id="page-description"></p><div id="page-content"></div>
			</section>

			<div class="map-hint is-hidden"><span><i data-lucide="locate-fixed"></i></span> Xaritadan nuqtani tanlang</div>
			<div class="brand-filter is-hidden"><span><small>BRAND MODE</small><strong id="brand-filter-name">EVOS</strong><b id="brand-filter-count">0 ta filial</b></span><button type="button" aria-label="Brand filtrini yopish"><i data-lucide="x"></i></button></div>
			<div class="territory-legend is-hidden"><strong>Xizmat hududi xaritasi</strong><p><i class="is-candidate"></i><span><b>Yangi lokatsiya</b>Sizning nuqtangiz eng yaqin bo‘lgan hudud</span></p><p><i class="is-competitor"></i><span><b>Raqib hududlari</b>Boshqa fast-food’lar yaqinroq bo‘lgan joylar</span></p><p><i class="is-generator"></i><span><b>Cell markazi</b>Hududni yaratgan haqiqiy fast-food POI</span></p><p><i class="is-radius"></i><span><b>Tahlil chegarasi</b>Siz tanlagan radius doirasi</span></p></div>
			<div class="map-tools"><button type="button" data-map-action="in" aria-label="Xaritani kattalashtirish"><i data-lucide="plus"></i></button><button type="button" data-map-action="out" aria-label="Xaritani kichraytirish"><i data-lucide="minus"></i></button></div>
		</main>
	` )

	createIcons( {
		icons: { ArrowLeft, ArrowLeftRight, ArrowRight, ChevronDown, FileText, HelpCircle, Layers3, LocateFixed, MapPin, Minus, Plus, Search, Settings, Store, Target, UserRound, X },
		attrs: { "stroke-width": 1.8 },
	} )

	let map
	let marker
	let radius = 1000
	let selectedPoint
	let selectedPoiId
	let activeWorkflow
	let isSelecting = false
	let poiFeatures = []
	let searchResults = []
	let activeSearchIndex = -1
	let activePopup
	let activePoiId
	let hoveredTerritoryId
	let territoryFeatures = []
	const layerSettings = readLayerSettings()

	const get = selector => root.querySelector( selector )
	const workflow = get( "[data-panel='workflow']" )
	const report = get( "[data-panel='report']" )
	const page = get( "[data-panel='page']" )
	const hint = get( ".map-hint" )
	const action = get( "#primary-action" )
	const searchInput = get( ".map-search input" )
	const searchPanel = get( ".search-results" )
	const brandFilter = get( ".brand-filter" )
	const territoryLegend = get( ".territory-legend" )
	const layersToggle = get( ".layers-toggle" )
	const layersPanel = get( ".layers-panel" )
	let poiLayerLoaded = false

	const hidePanels = () => [ workflow, report, page ].forEach( panel => panel.classList.add( "is-hidden" ) )
	const setActiveNav = view => root.querySelectorAll( ".nav-item" ).forEach( item => item.classList.toggle( "is-active", item.dataset.view === view ) )

	const clearSelection = () => {
		selectedPoint = null
		selectedPoiId = null
		isSelecting = false
		action.disabled = true
		get( "#selected-location" ).textContent = "Xaritani bosing"
		hint.classList.add( "is-hidden" )
		territoryLegend.classList.add( "is-hidden" )
		if( marker ) {
			marker.remove()
			marker = null
		}
		if( map?.getSource( "selection-radius" ) ) {
			map.getSource( "selection-radius" ).setData( { type: "FeatureCollection", features: [] } )
		}
		clearTerritoryHover()
		if( map?.getSource( "voronoi-analysis" ) ) {
			map.getSource( "voronoi-analysis" ).setData( { type: "FeatureCollection", features: [] } )
		}
		if( map?.getSource( "voronoi-sites" ) ) {
			map.getSource( "voronoi-sites" ).setData( { type: "FeatureCollection", features: [] } )
		}
		territoryFeatures = []
	}

	const selectLocation = ( point, poiId = null ) => {
		selectedPoint = point
		selectedPoiId = poiId
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
		closeLayerPanel()
		activePopup?.remove()
		clearBrandMode()
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

	const showMap = async() => {
		closeLayerPanel()
		hidePanels()
		clearSelection()
		clearBrandMode()
		setActiveNav( null )
		if( map ) {
			if( !poiLayerLoaded ) {
				await loadPoiLayer()
			}
			else {
				applyCustomLayerSettings()
			}
		}
	}

	const pageData = {
		reports: [ "HISOBOTLAR", "Mening hisobotlarim", "Saqlangan lokatsiya tahlillari shu yerda jamlanadi.", "Hali hisobot yo‘q", "Birinchi lokatsiyani tahlil qilganingizdan so‘ng hisobot shu yerda ko‘rinadi." ],
		compare: [ "SOLISHTIRISH", "Lokatsiyalarni taqqoslash", "Ikki yoki undan ortiq lokatsiyaning biznes signallarini yonma-yon solishtiring.", "Taqqoslash ro‘yxati bo‘sh", "Hisobotlardan lokatsiyalarni tanlab bu yerga qo‘shish mumkin bo‘ladi." ],
		settings: [ "SOZLAMALAR", "Mahsulot sozlamalari", "Standart radius, til va xarita ko‘rinishini boshqaring.", "Sozlamalar tez orada", "MVP davomida asosiy parametrlar shu bo‘limga qo‘shiladi." ],
	}

	const showPage = view => {
		closeLayerPanel()
		activePopup?.remove()
		clearBrandMode()
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
	const setLayerVisibility = ( layerIds, visible ) => layerIds.forEach( layerId => {
		if( map?.getLayer( layerId ) ) {
			map.setLayoutProperty( layerId, "visibility", visible ? "visible" : "none" )
		}
	} )
	const applyBasemapSettings = () => {
		if( !map ) {
			return
		}
		const config = {
			showPlaceLabels: layerSettings.placeLabels,
			showRoadLabels: layerSettings.roadLabels,
			showPointOfInterestLabels: layerSettings.poiLabels,
			showTransitLabels: layerSettings.transitLabels,
			show3dObjects: layerSettings.objects3d,
		}
		Object.entries( config ).forEach( ( [ key, value ] ) => map.setConfigProperty( "basemap", key, value ) )
	}
	const applyCustomLayerSettings = () => {
		if( !map ) {
			return
		}
		setLayerVisibility( [ "fast-food-heatmap" ], layerSettings.fastFoodHeatmap )
		setLayerVisibility( [ "fast-food-point-glow", "fast-food-points" ], layerSettings.fastFoodPoints )
		setLayerVisibility( [ "voronoi-analysis-fill", "voronoi-analysis-glow", "voronoi-analysis-line", "voronoi-site-glow", "voronoi-site-points" ], layerSettings.serviceAreas )
		territoryLegend.classList.toggle( "is-hidden", !layerSettings.serviceAreas || territoryFeatures.length === 0 )
	}
	const syncLayerControls = () => get( ".layers-panel" ).querySelectorAll( "[data-layer-setting]" ).forEach( button => {
		const enabled = Boolean( layerSettings[ button.dataset.layerSetting ] )
		button.classList.toggle( "is-active", enabled )
		button.setAttribute( "aria-checked", String( enabled ) )
	} )
	const saveLayerSettings = () => localStorage.setItem( "ummon-layer-settings", JSON.stringify( layerSettings ) )
	const closeLayerPanel = () => {
		layersPanel.classList.add( "is-hidden" )
		layersToggle.classList.remove( "is-active" )
		layersToggle.setAttribute( "aria-expanded", "false" )
	}
	const setBrandLayerVisibility = visibility => {
		[ "fast-food-brand-glow", "fast-food-brand-points" ].forEach( layerId => {
			if( map.getLayer( layerId ) ) {
				map.setLayoutProperty( layerId, "visibility", visibility )
			}
		} )
	}

	const cleanName = value => String( value || "Nomsiz fast food" ).replace( /^"+|"+$/g, "" )
	const normalizeSearch = value => String( value || "" ).toLocaleLowerCase( "uz" ).replace( /[’'`]/g, "" ).replace( /[^\p{L}\p{N}]+/gu, " " ).trim()
	const distanceMeters = ( point, coordinates ) => {
		const earthRadius = 6371000
		const latitude1 = point.lat * Math.PI / 180
		const latitude2 = coordinates[ 1 ] * Math.PI / 180
		const latitudeDelta = ( coordinates[ 1 ] - point.lat ) * Math.PI / 180
		const longitudeDelta = ( coordinates[ 0 ] - point.lng ) * Math.PI / 180
		const value = Math.sin( latitudeDelta / 2 ) ** 2
			+ Math.cos( latitude1 ) * Math.cos( latitude2 ) * Math.sin( longitudeDelta / 2 ) ** 2

		return earthRadius * 2 * Math.atan2( Math.sqrt( value ), Math.sqrt( 1 - value ) )
	}
	const formatDistance = distance => distance < 1000 ? `${ Math.round( distance ) } m` : `${ ( distance / 1000 ).toFixed( 1 ) } km`
	const formatArea = squareKilometers => squareKilometers < 1
		? `${ new Intl.NumberFormat( "uz-UZ" ).format( Math.round( squareKilometers * 1000000 ) ) } m²`
		: `${ squareKilometers.toFixed( 2 ) } km²`
	const calculateTerritoryAnalysis = () => {
		const boundary = circle( [ selectedPoint.lng, selectedPoint.lat ], radius / 1000, { steps: 72, units: "kilometers" } )
		const contextRadius = radius
		const contextBbox = bbox( boundary )
		const uniqueCoordinates = new Set( [ `${ selectedPoint.lng.toFixed( 7 ) }:${ selectedPoint.lat.toFixed( 7 ) }` ] )
		const nearbyFeatures = poiFeatures.filter( feature => {
			if( feature.properties.id === selectedPoiId ) {
				return false
			}
			const distance = distanceMeters( selectedPoint, feature.geometry.coordinates )
			const coordinateKey = `${ feature.geometry.coordinates[ 0 ].toFixed( 7 ) }:${ feature.geometry.coordinates[ 1 ].toFixed( 7 ) }`
			if( distance <= 3 || distance > contextRadius || uniqueCoordinates.has( coordinateKey ) ) {
				return false
			}
			uniqueCoordinates.add( coordinateKey )
			return true
		} )
		const candidate = point( [ selectedPoint.lng, selectedPoint.lat ], { id: "candidate-location", kind: "candidate", name: "Yangi lokatsiya" } )
		const inputs = featureCollection( [
			candidate,
			...nearbyFeatures.map( feature => point( feature.geometry.coordinates, {
				id: feature.properties.id,
				kind: "competitor",
				name: cleanName( feature.properties.name ),
				distance: distanceMeters( selectedPoint, feature.geometry.coordinates ),
			} ) ),
		] )
		let clippedFeatures = []

		if( inputs.features.length === 1 ) {
			boundary.properties = candidate.properties
			clippedFeatures = [ boundary ]
		}
		else {
			const polygons = voronoi( inputs, { bbox: contextBbox } )
			clippedFeatures = polygons.features.flatMap( polygonFeature => {
				const clipped = intersect( featureCollection( [ polygonFeature, boundary ] ) )
				if( !clipped ) {
					return []
				}
				clipped.properties = { ...polygonFeature.properties }
				return [ clipped ]
			} )
		}

		clippedFeatures.forEach( feature => feature.properties.areaKm2 = area( feature ) / 1000000 )
		territoryFeatures = clippedFeatures
		map.getSource( "voronoi-analysis" )?.setData( featureCollection( clippedFeatures ) )
		map.getSource( "voronoi-sites" )?.setData( inputs )
		const analysisBbox = bbox( boundary )
		const analysisPadding = window.innerWidth <= 800
			? { top: 45, right: 30, bottom: 170, left: 30 }
			: { top: 70, right: 520, bottom: 70, left: 70 }
		map.fitBounds( analysisBbox, { padding: analysisPadding, maxZoom: 16, duration: 900 } )
		const candidateCell = clippedFeatures.find( feature => feature.properties.kind === "candidate" )
		const competitorCells = clippedFeatures.filter( feature => feature.properties.kind === "competitor" && feature.properties.distance <= radius )
		const totalArea = area( boundary ) / 1000000
		const candidateArea = candidateCell?.properties.areaKm2 ?? totalArea
		const averageCompetitorArea = competitorCells.length
			? competitorCells.reduce( ( sum, feature ) => sum + feature.properties.areaKm2, 0 ) / competitorCells.length
			: null
		const comparison = averageCompetitorArea ? candidateArea / averageCompetitorArea : null
		const smallerCompetitors = competitorCells.filter( feature => feature.properties.areaKm2 < candidateArea ).length
		const percentile = competitorCells.length ? Math.round( smallerCompetitors / competitorCells.length * 100 ) : null

		return { totalArea, candidateArea, averageCompetitorArea, comparison, percentile }
	}
	const analyzeCompetition = () => {
		const competitors = poiFeatures
			.filter( feature => feature.properties.id !== selectedPoiId )
			.map( feature => ( { feature, distance: distanceMeters( selectedPoint, feature.geometry.coordinates ) } ) )
			.filter( item => item.distance > 3 )
			.sort( ( first, second ) => first.distance - second.distance )
		const within500 = competitors.filter( item => item.distance <= 500 )
		const within1000 = competitors.filter( item => item.distance <= 1000 )
		const within2000 = competitors.filter( item => item.distance <= 2000 )
		const withinRadius = competitors.filter( item => item.distance <= radius )
		const brandCounts = new Map()
		withinRadius.forEach( item => {
			const { brandId, brandName } = item.feature.properties
			if( brandId ) {
				const current = brandCounts.get( brandId ) ?? { name: brandName || brandId, count: 0 }
				current.count++
				brandCounts.set( brandId, current )
			}
		} )
		const dominantBrand = [ ...brandCounts.values() ].sort( ( first, second ) => second.count - first.count )[ 0 ]
		const nearest = competitors[ 0 ]
		const outer1000 = within1000.length - within500.length
		const outer2000 = within2000.length - within1000.length
		const pressureScore = Math.min( 100, Math.round( within500.length * 10 + outer1000 * 3 + outer2000 * 0.75 ) )
		const pressureLevel = pressureScore >= 70 ? "Yuqori" : pressureScore >= 35 ? "O‘rtacha" : "Past"
		const territory = calculateTerritoryAnalysis()
		const insight = pressureScore >= 70
			? "Bu hududda fast-food klasteri shakllangan. Talab signali bo‘lishi mumkin, ammo yangi biznes aniq format va kuchli differensiatsiya bilan kirishi kerak."
			: pressureScore >= 35
				? "Raqobat muvozanatli. Yaqin raqiblarning formati va dominant brand taklifidan farqlanish imkoniyati bor."
				: "Bevosita raqobat past. Bu imkoniyat bo‘lishi mumkin, lekin past zichlik talab yetarli degani emas — keyingi signallar bilan tekshirish kerak."

		get( "#competition-score" ).textContent = pressureScore
		get( "#competition-level" ).textContent = `${ pressureLevel } bosim`
		get( "#competition-summary" ).textContent = `${ radius / 1000 } km radiusda ${ withinRadius.length } ta raqobatchi aniqlandi.`
		get( "#competitor-count" ).textContent = withinRadius.length
		get( "#brand-count" ).textContent = brandCounts.size
		get( "#nearest-distance" ).textContent = nearest ? formatDistance( nearest.distance ) : "—"
		get( "#dominant-brand" ).textContent = dominantBrand ? `${ dominantBrand.name } · ${ dominantBrand.count }` : "—"
		get( "#band-500" ).textContent = within500.length
		get( "#band-1000" ).textContent = within1000.length
		get( "#band-2000" ).textContent = within2000.length
		get( "#candidate-area" ).textContent = formatArea( territory.candidateArea )
		get( "#analysis-area" ).textContent = formatArea( territory.totalArea )
		get( "#territory-share" ).textContent = `Umumiy maydonning ${ Math.round( territory.candidateArea / territory.totalArea * 100 ) }% qismi`
		get( "#average-area" ).textContent = territory.averageCompetitorArea ? formatArea( territory.averageCompetitorArea ) : "Raqib yo‘q"
		get( "#area-comparison" ).textContent = territory.comparison ? `${ territory.comparison.toFixed( 1 ) }×` : "—"
		const maximumComparedArea = Math.max( territory.candidateArea, territory.averageCompetitorArea ?? 0 )
		get( "#candidate-area-bar" ).style.width = `${ maximumComparedArea ? territory.candidateArea / maximumComparedArea * 100 : 0 }%`
		get( "#average-area-bar" ).style.width = `${ maximumComparedArea && territory.averageCompetitorArea ? territory.averageCompetitorArea / maximumComparedArea * 100 : 0 }%`
		get( "#candidate-area-label" ).textContent = formatArea( territory.candidateArea )
		get( "#average-area-label" ).textContent = territory.averageCompetitorArea ? formatArea( territory.averageCompetitorArea ) : "Raqib yo‘q"
		get( "#territory-insight" ).textContent = territory.comparison
			? `Yangi nuqtaning taxminiy hududi yaqin raqiblar o‘rtachasidan ${ territory.comparison >= 1 ? "kattaroq" : "kichikroq" }. Hudud maydoni bo‘yicha raqiblarning ${ territory.percentile }%idan yuqori.`
			: "Tanlangan radiusda taqqoslash uchun raqobatchi yo‘q; yangi nuqta butun tahlil hududini qamrab oladi."
		get( "#nearest-competitor" ).textContent = nearest
			? `${ cleanName( nearest.feature.properties.name ) } — ${ formatDistance( nearest.distance ) } masofada.`
			: "2 km atrofida raqobatchi topilmadi."
		get( "#competition-insight" ).textContent = insight
		get( ".score-ring" ).style.setProperty( "--score-angle", `${ pressureScore * 3.6 }deg` )
	}
	const clearActivePoi = () => {
		if( activePoiId && map?.getSource( "fast-food-poi" ) ) {
			map.setFeatureState( { source: "fast-food-poi", id: activePoiId }, { selected: false } )
		}
		activePoiId = null
	}
	const clearTerritoryHover = () => {
		if( hoveredTerritoryId && map?.getSource( "voronoi-analysis" ) ) {
			map.setFeatureState( { source: "voronoi-analysis", id: hoveredTerritoryId }, { hover: false } )
		}
		hoveredTerritoryId = null
	}
	const getTerritoryAt = lngLat => {
		if( territoryFeatures.length === 0 ) {
			return null
		}
		const cursorPoint = point( [ lngLat.lng, lngLat.lat ] )
		return territoryFeatures.find( feature => booleanPointInPolygon( cursorPoint, feature ) ) ?? null
	}
	const createTerritoryPopup = ( properties, lngLat ) => {
		activePopup?.remove()
		const content = document.createElement( "div" )
		const label = document.createElement( "span" )
		const name = document.createElement( "strong" )
		const description = document.createElement( "p" )
		const metrics = document.createElement( "div" )
		const areaMetric = document.createElement( "span" )
		const distanceMetric = document.createElement( "span" )
		content.className = "territory-popup__content"
		label.textContent = properties.kind === "candidate" ? "YANGI LOKATSIYA HUDUDI" : "RAQIB XIZMAT HUDUDI"
		name.textContent = properties.kind === "candidate" ? "Siz tanlagan nuqta" : cleanName( properties.name )
		description.textContent = properties.kind === "candidate"
			? "Bu polygon ichidagi joylar uchun yangi lokatsiya eng yaqin fast-food hisoblanadi."
			: "Bu polygon ichidagi joylar uchun ushbu raqobatchi eng yaqin fast-food hisoblanadi."
		areaMetric.innerHTML = `<small>Maydon</small><b>${ formatArea( Number( properties.areaKm2 ) ) }</b>`
		distanceMetric.innerHTML = `<small>Markazdan</small><b>${ properties.kind === "candidate" ? "0 m" : formatDistance( Number( properties.distance ) ) }</b>`
		metrics.append( areaMetric, distanceMetric )
		content.append( label, name, description, metrics )
		const territoryPopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: false, offset: 12, maxWidth: "320px", className: "territory-popup" } )
			.setLngLat( lngLat )
			.setDOMContent( content )
			.addTo( map )
		activePopup = territoryPopup
		territoryPopup.on( "close", () => {
			if( activePopup === territoryPopup ) {
				activePopup = null
			}
		} )
	}

	const clearBrandMode = () => {
		brandFilter.classList.add( "is-hidden" )
		if( poiLayerLoaded ) {
			setBrandLayerVisibility( "none" )
			applyCustomLayerSettings()
		}
	}

	const showBrandMode = ( brandId, brandName ) => {
		const brandFeatures = poiFeatures.filter( feature => feature.properties.brandId === brandId )
		if( brandFeatures.length < 2 ) {
			return
		}
		const filter = [ "==", [ "get", "brandId" ], brandId ]
		const brandLayerIds = [ "fast-food-brand-glow", "fast-food-brand-points" ]
		brandLayerIds.forEach( layerId => map.setFilter( layerId, filter ) )
		setPoiLayerVisibility( "none" )
		setBrandLayerVisibility( "visible" )
		get( "#brand-filter-name" ).textContent = brandName
		get( "#brand-filter-count" ).textContent = `${ brandFeatures.length } ta filial`
		brandFilter.classList.remove( "is-hidden" )
		const longitudes = brandFeatures.map( feature => feature.geometry.coordinates[ 0 ] )
		const latitudes = brandFeatures.map( feature => feature.geometry.coordinates[ 1 ] )
		map.fitBounds( [
			[ Math.min( ...longitudes ), Math.min( ...latitudes ) ],
			[ Math.max( ...longitudes ), Math.max( ...latitudes ) ],
		], { padding: { top: 100, right: 90, bottom: 90, left: 90 }, maxZoom: 14, duration: 1000 } )
	}

	const createPoiPopup = ( properties, coordinates ) => {
		if( activePopup ) {
			activePopup.remove()
		}
		clearActivePoi()
		activePoiId = properties.id
		if( activePoiId ) {
			map.setFeatureState( { source: "fast-food-poi", id: activePoiId }, { selected: true } )
		}
		const confidence = Math.round( Number( properties.confidence ) * 100 )
		const content = document.createElement( "div" )
		const header = document.createElement( "div" )
		const label = document.createElement( "span" )
		const name = document.createElement( "strong" )
		const details = document.createElement( "small" )
		const meta = document.createElement( "div" )
		const coordinate = document.createElement( "p" )
		const analyzeButton = document.createElement( "button" )
		const brandFeatures = properties.brandId ? poiFeatures.filter( feature => feature.properties.brandId === properties.brandId ) : []
		const brandButton = brandFeatures.length > 1 ? document.createElement( "button" ) : null
		header.className = "poi-popup__header"
		label.className = "poi-popup__label"
		name.className = "poi-popup__name"
		details.className = "poi-popup__type"
		meta.className = "poi-popup__meta"
		coordinate.className = "poi-popup__coordinate"
		analyzeButton.className = "poi-popup__action"
		label.textContent = "Fast food nuqtasi"
		name.textContent = cleanName( properties.name )
		details.textContent = String( properties.subtype || "fast food" ).replaceAll( "_", " " )
		meta.textContent = `Ma’lumot ishonchliligi: ${ Number.isFinite( confidence ) ? confidence : "—" }%`
		coordinate.textContent = `${ coordinates[ 1 ].toFixed( 5 ) }, ${ coordinates[ 0 ].toFixed( 5 ) }`
		analyzeButton.textContent = "Shu lokatsiyani tahlil qilish"
		header.append( label, details )
		content.append( header, name, meta, coordinate, analyzeButton )
		if( brandButton ) {
			brandButton.className = "poi-popup__brand-action"
			brandButton.textContent = `Barcha ${ properties.brandName || cleanName( properties.name ) } filiallari · ${ brandFeatures.length }`
			content.append( brandButton )
		}

		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 18, maxWidth: "340px", className: "poi-popup" } )
			.setLngLat( coordinates )
			.setDOMContent( content )
			.addTo( map )
		const popupPoiId = activePoiId
		activePopup.on( "close", () => {
			if( activePoiId === popupPoiId ) {
				clearActivePoi()
				activePopup = null
			}
		} )
		analyzeButton.addEventListener( "click", () => {
			activePopup.remove()
			startWorkflow( "analyze" )
			selectLocation( { lng: coordinates[ 0 ], lat: coordinates[ 1 ] }, properties.id )
		} )
		brandButton?.addEventListener( "click", () => {
			activePopup.remove()
			showBrandMode( properties.brandId, properties.brandName || cleanName( properties.name ) )
		} )
	}

	const closeSearch = () => {
		searchPanel.hidden = true
		searchInput.setAttribute( "aria-expanded", "false" )
		activeSearchIndex = -1
	}

	const selectSearchResult = feature => {
		const coordinates = feature.geometry.coordinates
		closeSearch()
		clearBrandMode()
		searchInput.value = cleanName( feature.properties.name )
		hidePanels()
		clearSelection()
		setActiveNav( null )
		applyCustomLayerSettings()
		map.easeTo( { center: coordinates, zoom: 15, duration: 900 } )
		createPoiPopup( feature.properties, coordinates )
	}

	const renderSearchResults = query => {
		const normalizedQuery = normalizeSearch( query )
		searchPanel.replaceChildren()
		if( normalizedQuery.length < 2 ) {
			closeSearch()
			return
		}

		searchResults = poiFeatures
			.map( feature => {
				const properties = feature.properties
				const name = normalizeSearch( properties.name )
				const brand = normalizeSearch( `${ properties.brandName || "" } ${ properties.brand || "" }` )
				const address = normalizeSearch( properties.address )
				const subtype = normalizeSearch( properties.subtype )
				const aliases = normalizeSearch( Array.isArray( properties.aliases ) ? properties.aliases.join( " " ) : properties.aliases )
				const searchable = `${ name } ${ brand } ${ address } ${ subtype } ${ aliases }`
				if( !searchable.includes( normalizedQuery ) ) {
					return null
				}
				const score = name === normalizedQuery ? 0 : name.startsWith( normalizedQuery ) ? 1 : name.includes( normalizedQuery ) ? 2 : address.startsWith( normalizedQuery ) ? 3 : 4
				return { feature, score }
			} )
			.filter( Boolean )
			.sort( ( first, second ) => first.score - second.score )
			.slice( 0, 8 )
			.map( result => result.feature )

		if( searchResults.length === 0 ) {
			const empty = document.createElement( "p" )
			empty.className = "search-empty"
			empty.textContent = "Mos fast food topilmadi"
			searchPanel.append( empty )
		}
		else {
			searchResults.forEach( ( feature, index ) => {
				const button = document.createElement( "button" )
				const icon = document.createElement( "span" )
				const copy = document.createElement( "span" )
				const name = document.createElement( "strong" )
				const meta = document.createElement( "small" )
				button.type = "button"
				button.role = "option"
				button.dataset.searchIndex = index
				icon.className = "search-result__icon"
				icon.textContent = "●"
				copy.className = "search-result__copy"
				name.textContent = cleanName( feature.properties.name )
				meta.textContent = [ feature.properties.address, String( feature.properties.subtype || "" ).replaceAll( "_", " " ) ].filter( Boolean ).join( " · " )
				copy.append( name, meta )
				button.append( icon, copy )
				button.addEventListener( "mousedown", event => event.preventDefault() )
				button.addEventListener( "click", () => selectSearchResult( feature ) )
				searchPanel.append( button )
			} )
		}
		activeSearchIndex = -1
		searchPanel.hidden = false
		searchInput.setAttribute( "aria-expanded", "true" )
	}

	const loadPoiLayer = async() => {
		try {
			const response = await fetch( "/data/fast-food-final.geojson" )
			if( !response.ok ) {
				throw new Error( `POI data request failed: ${ response.status }` )
			}

			const data = await response.json()
			poiFeatures = data.features
			if( searchInput.value.trim().length >= 2 ) {
				renderSearchResults( searchInput.value )
			}
			map.addSource( "fast-food-poi", {
				type: "geojson",
				data,
				promoteId: "id",
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
			map.addLayer( {
				id: "fast-food-brand-glow",
				type: "circle",
				source: "fast-food-poi",
				layout: { visibility: "none" },
				paint: {
					"circle-color": "#38bdf8",
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 10, 14, 20 ],
					"circle-blur": 0.76,
					"circle-opacity": 0.65,
					"circle-emissive-strength": 2.8,
				},
			} )
			map.addLayer( {
				id: "fast-food-brand-points",
				type: "circle",
				source: "fast-food-poi",
				layout: { visibility: "none" },
				paint: {
					"circle-color": "#e7f8ff",
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 5, 14, 9 ],
					"circle-stroke-color": "#168cff",
					"circle-stroke-width": 3,
					"circle-emissive-strength": 2.2,
				},
			} )
			map.addLayer( {
				id: "fast-food-selected-glow",
				type: "circle",
				source: "fast-food-poi",
				paint: {
					"circle-color": "#1c91ff",
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 19, 15, 30 ],
					"circle-blur": 0.7,
					"circle-opacity": [ "case", [ "boolean", [ "feature-state", "selected" ], false ], 0.82, 0 ],
					"circle-emissive-strength": 3,
				},
			} )
			map.addLayer( {
				id: "fast-food-selected-point",
				type: "circle",
				source: "fast-food-poi",
				paint: {
					"circle-color": "#f4fbff",
					"circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 7, 15, 12 ],
					"circle-opacity": [ "case", [ "boolean", [ "feature-state", "selected" ], false ], 1, 0 ],
					"circle-stroke-color": "#168cff",
					"circle-stroke-width": 4,
					"circle-stroke-opacity": [ "case", [ "boolean", [ "feature-state", "selected" ], false ], 1, 0 ],
					"circle-emissive-strength": 2.5,
				},
			} )

			const handlePoiClick = event => {
				const properties = event.features[ 0 ].properties
				const coordinates = [ ...event.features[ 0 ].geometry.coordinates ]
				createPoiPopup( properties, coordinates )
			}
			[ "fast-food-points", "fast-food-brand-points" ].forEach( layerId => {
				map.on( "click", layerId, handlePoiClick )
				map.on( "mouseenter", layerId, () => map.getCanvas().style.cursor = "pointer" )
				map.on( "mouseleave", layerId, () => map.getCanvas().style.cursor = "default" )
			} )
			poiLayerLoaded = true
			applyCustomLayerSettings()
		}
		catch( error ) {
			console.error( error )
		}
	}

	window.addEventListener( "ummon:map-ready", event => {
		map = event.detail
		applyBasemapSettings()
		map.addSource( "selection-radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } } )
		map.addSource( "voronoi-analysis", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addSource( "voronoi-sites", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addLayer( { id: "selection-radius-fill", type: "fill", source: "selection-radius", paint: { "fill-color": "#2388ff", "fill-opacity": 0.035, "fill-emissive-strength": 0.25 } } )
		map.addLayer( { id: "voronoi-analysis-fill", type: "fill", source: "voronoi-analysis", paint: { "fill-color": [ "match", [ "get", "kind" ], "candidate", "#009dff", "#315f91" ], "fill-opacity": [ "case", [ "boolean", [ "feature-state", "hover" ], false ], [ "match", [ "get", "kind" ], "candidate", 0.78, 0.55 ], [ "match", [ "get", "kind" ], "candidate", 0.62, 0.34 ] ], "fill-emissive-strength": 1.2 } } )
		map.addLayer( { id: "voronoi-analysis-glow", type: "line", source: "voronoi-analysis", filter: [ "==", [ "get", "kind" ], "candidate" ], paint: { "line-color": "#00a8ff", "line-width": 14, "line-blur": 8, "line-opacity": 0.9, "line-emissive-strength": 3 } } )
		map.addLayer( { id: "voronoi-analysis-line", type: "line", source: "voronoi-analysis", paint: { "line-color": [ "match", [ "get", "kind" ], "candidate", "#e0f7ff", "#79b9ea" ], "line-width": [ "case", [ "boolean", [ "feature-state", "hover" ], false ], [ "match", [ "get", "kind" ], "candidate", 5, 3.5 ], [ "match", [ "get", "kind" ], "candidate", 4, 2 ] ], "line-opacity": [ "match", [ "get", "kind" ], "candidate", 1, 0.9 ], "line-emissive-strength": [ "match", [ "get", "kind" ], "candidate", 2.8, 1.35 ] } } )
		map.addLayer( { id: "voronoi-site-glow", type: "circle", source: "voronoi-sites", paint: { "circle-color": [ "match", [ "get", "kind" ], "candidate", "#00a8ff", "#7ca9dc" ], "circle-radius": [ "match", [ "get", "kind" ], "candidate", 17, 12 ], "circle-blur": 0.78, "circle-opacity": 0.72, "circle-emissive-strength": 2.5 } } )
		map.addLayer( { id: "voronoi-site-points", type: "circle", source: "voronoi-sites", paint: { "circle-color": [ "match", [ "get", "kind" ], "candidate", "#ffffff", "#d8e9fb" ], "circle-radius": [ "match", [ "get", "kind" ], "candidate", 8, 6 ], "circle-stroke-color": [ "match", [ "get", "kind" ], "candidate", "#00a8ff", "#547ca9" ], "circle-stroke-width": [ "match", [ "get", "kind" ], "candidate", 3, 2 ], "circle-emissive-strength": 2 } } )
		map.addLayer( { id: "selection-radius-glow", type: "line", source: "selection-radius", paint: { "line-color": "#168cff", "line-width": 7, "line-blur": 5, "line-opacity": 0.38, "line-emissive-strength": 1.8 } } )
		map.addLayer( { id: "selection-radius-line", type: "line", source: "selection-radius", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#bcecff", "line-width": 3.5, "line-dasharray": [ 2, 1.6 ], "line-opacity": 1, "line-emissive-strength": 2.2 } } )
		map.on( "click", event => {
			if( isSelecting ) {
				selectLocation( event.lngLat )
				return
			}
			const territoryFeature = getTerritoryAt( event.lngLat )
			if( territoryFeature ) {
				createTerritoryPopup( territoryFeature.properties, event.lngLat )
			}
		} )
		map.on( "mousemove", event => {
			const territoryFeature = getTerritoryAt( event.lngLat )
			if( territoryFeature ) {
				const territoryId = territoryFeature.properties.id
				if( hoveredTerritoryId !== territoryId ) {
					clearTerritoryHover()
					hoveredTerritoryId = territoryId
					map.setFeatureState( { source: "voronoi-analysis", id: hoveredTerritoryId }, { hover: true } )
				}
				map.getCanvas().style.cursor = "pointer"
			}
			else if( hoveredTerritoryId ) {
				clearTerritoryHover()
				map.getCanvas().style.cursor = "default"
			}
		} )
		applyCustomLayerSettings()
		loadPoiLayer()
	} )

	searchInput.addEventListener( "input", () => renderSearchResults( searchInput.value ) )
	searchInput.addEventListener( "focus", () => {
		if( searchInput.value.trim().length >= 2 ) {
			renderSearchResults( searchInput.value )
		}
	} )
	searchInput.addEventListener( "keydown", event => {
		if( event.key === "Escape" ) {
			closeSearch()
			searchInput.blur()
			return
		}
		if( ![ "ArrowDown", "ArrowUp", "Enter" ].includes( event.key ) || searchResults.length === 0 ) {
			return
		}
		event.preventDefault()
		if( event.key === "Enter" ) {
			selectSearchResult( searchResults[ activeSearchIndex < 0 ? 0 : activeSearchIndex ] )
			return
		}
		const direction = event.key === "ArrowDown" ? 1 : -1
		activeSearchIndex = ( activeSearchIndex + direction + searchResults.length ) % searchResults.length
		searchPanel.querySelectorAll( "button" ).forEach( ( button, index ) => {
			button.classList.toggle( "is-active", index === activeSearchIndex )
			button.setAttribute( "aria-selected", String( index === activeSearchIndex ) )
		} )
	} )
	document.addEventListener( "click", event => {
		if( !get( ".map-search" ).contains( event.target ) ) {
			closeSearch()
		}
		if( !get( ".layer-control" ).contains( event.target ) ) {
			closeLayerPanel()
		}
	} )
	document.addEventListener( "keydown", event => {
		if( ( event.metaKey || event.ctrlKey ) && event.key.toLowerCase() === "k" ) {
			event.preventDefault()
			searchInput.focus()
		}
	} )

	root.querySelectorAll( ".nav-item" ).forEach( button => button.addEventListener( "click", () => {
		if( [ "analyze", "find" ].includes( button.dataset.view ) ) {
			startWorkflow( button.dataset.view )
		}
		else {
			showPage( button.dataset.view )
		}
	} ) )
	get( ".back-button" ).addEventListener( "click", showMap )
	get( ".close-button" ).addEventListener( "click", showMap )
	get( ".close-report" ).addEventListener( "click", showMap )
	get( ".close-page" ).addEventListener( "click", showMap )
	brandFilter.querySelector( "button" ).addEventListener( "click", clearBrandMode )
	layersToggle.addEventListener( "click", () => {
		const opening = layersPanel.classList.contains( "is-hidden" )
		layersPanel.classList.toggle( "is-hidden", !opening )
		layersToggle.classList.toggle( "is-active", opening )
		layersToggle.setAttribute( "aria-expanded", String( opening ) )
	} )
	get( ".close-layers" ).addEventListener( "click", () => {
		closeLayerPanel()
	} )
	layersPanel.querySelectorAll( "[data-layer-setting]" ).forEach( button => button.addEventListener( "click", () => {
		const key = button.dataset.layerSetting
		layerSettings[ key ] = !layerSettings[ key ]
		saveLayerSettings()
		syncLayerControls()
		if( [ "placeLabels", "roadLabels", "poiLabels", "transitLabels", "objects3d" ].includes( key ) ) {
			applyBasemapSettings()
		}
		else {
			applyCustomLayerSettings()
		}
	} ) )
	syncLayerControls()

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
		closeLayerPanel()
		layerSettings.serviceAreas = true
		saveLayerSettings()
		syncLayerControls()
		analyzeCompetition()
		applyCustomLayerSettings()
		territoryLegend.classList.toggle( "is-hidden", !layerSettings.serviceAreas )
		hidePanels()
		report.classList.remove( "is-hidden" )
		get( "#report-title" ).textContent = activeWorkflow === "find" ? "Hudud raqobati" : "Raqobat tahlili"
		get( "#report-location" ).textContent = `${ selectedPoint.lat.toFixed( 5 ) }, ${ selectedPoint.lng.toFixed( 5 ) } · ${ radius / 1000 } km`
	} )
}
