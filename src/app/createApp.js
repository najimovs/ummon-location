import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
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
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js"
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
	metro: true,
	demandGenerators: false,
	serviceAreas: true,
	districts: true,
	opportunityMap: true,
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
			<div class="map-search"><span><i data-lucide="search"></i></span><input type="search" placeholder="Fast food yoki manzilni qidiring" aria-label="Fast food qidirish" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"><kbd>⌘ K</kbd><div class="search-results" id="search-results" role="listbox" hidden></div></div>
			<div class="layer-control">
				<button class="layers-toggle" type="button" aria-expanded="false" aria-controls="layers-panel"><i data-lucide="layers-3"></i><span>Qatlamlar</span></button>
				<section class="layers-panel is-hidden" id="layers-panel" aria-label="Xarita qatlamlari">
					<header><div><span>XARITA SOZLAMALARI</span><strong>Qatlamlar</strong></div><button class="close-layers" type="button" aria-label="Qatlamlarni yopish"><i data-lucide="x"></i></button></header>
					<div class="layer-group"><b>Ummon data</b>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodPoints"><span><i class="layer-dot is-poi"></i><em>Fast-food nuqtalari<small>Restoran va tarmoq manzillari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodHeatmap"><span><i class="layer-dot is-heatmap"></i><em>Zichlik heatmap’i<small>Fast-food klasterlari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="metro"><span><i class="layer-dot is-metro"></i><em>Metro bekatlari<small>Bekatlar va kirish nuqtalari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="demandGenerators"><span><i class="layer-dot is-demand"></i><em>Talab generatorlari<small>Ta’lim, ofis, savdo va boshqa oqimlar</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="serviceAreas"><span><i class="layer-dot is-area"></i><em>Xizmat hududlari<small>Joy tahlilidan keyin ochiladi</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="districts"><span><i class="layer-dot is-district"></i><em>Tumanlar<small>Chegara va tuman nomlari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="opportunityMap"><span><i class="layer-dot is-h3"></i><em>Imkoniyat xaritasi<small>“Joy topish” natijasidan keyin ochiladi</small></em></span><i></i></button>
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
				<button class="nav-item" type="button" data-view="settings"><span><i data-lucide="settings"></i></span><b>Sozlamalar</b></button>
			</div>
		</aside>

		<main class="map-workspace">
			<section class="workflow-panel is-hidden" data-panel="workflow">
				<div class="panel-top"><button class="back-button" type="button"><i data-lucide="arrow-left"></i></button><div><span class="eyebrow">YANGI TAHLIL</span><h2 id="workflow-title">Lokatsiyani belgilang</h2></div><button class="close-button" type="button"><i data-lucide="x"></i></button></div>
				<p id="workflow-description">Xaritadan fast food ochmoqchi bo‘lgan aniq nuqtani tanlang.</p>
				<div class="step"><span>1</span><div><small>NUQTA</small><strong id="selected-location">Xaritani bosing</strong></div></div>
				<fieldset class="district-field is-hidden"><legend>Tumanni tanlang</legend><label class="select-wrap"><span><i data-lucide="map-pin"></i></span><select id="district-select"><option value="">Tuman tanlanmagan</option></select></label></fieldset>
				<fieldset><legend>2 &nbsp; Tahlil radiusi</legend><div class="segments" data-control="radius"><button type="button" data-value="500">500 m</button><button class="is-active" type="button" data-value="1000">1 km</button><button type="button" data-value="2000">2 km</button></div></fieldset>
				<fieldset><legend>3 &nbsp; Fast food formati</legend><label class="select-wrap"><span><i data-lucide="store"></i></span><select><option>Universal fast food</option><option>Student / budget</option><option>Family fast food</option><option>Delivery-first</option><option>Roadside</option></select></label></fieldset>
				<button class="primary-action" id="primary-action" type="button" disabled><span>Tahlilni boshlash</span><b><i data-lucide="arrow-right"></i></b></button>
			</section>

			<section class="report-panel is-hidden" data-panel="report">
				<div class="report-head"><div><span class="eyebrow">REAL GEO ANALYTICS</span><h2 id="report-title">Raqobat tahlili</h2><small id="report-location">Tanlangan lokatsiya</small></div><button class="close-report" type="button"><i data-lucide="x"></i></button></div>
				<div class="district-context analysis-only"><span>TUMAN KONTEKSTI</span><strong id="analysis-district">Aniqlanmoqda…</strong><div><p><small>Aholi</small><b id="district-population">—</b></p><p><small>Fast-food</small><b id="district-pois">—</b></p><p><small>10 000 aholiga</small><b id="district-per-capita">—</b></p><p><small>Taqqoslash</small><b id="district-comparison">—</b></p></div></div>
				<div class="score-block analysis-only"><div class="score-ring"><strong id="competition-score">—</strong><small>/100</small></div><div><span>RAQOBAT BOSIMI</span><strong id="competition-level">Hisoblanmoqda</strong><p id="competition-summary">Radius ichidagi fast-food nuqtalari asosida.</p></div></div>
				<div class="metric-grid analysis-only"><article><span>Raqobatchilar</span><strong id="competitor-count">—</strong></article><article><span>Tarmoq brendlari</span><strong id="brand-count">—</strong></article><article><span>Eng yaqin raqib</span><strong id="nearest-distance">—</strong></article><article><span>Yetakchi brend</span><strong id="dominant-brand">—</strong></article></div>
				<div class="metro-analysis analysis-only"><div><span>METRO QULAYLIGI</span><strong id="metro-access-score">—</strong></div><div><p><small>Eng yaqin bekat</small><b id="nearest-metro-name">—</b><em id="nearest-metro-distance">—</em></p><p><small>Radius ichida</small><b id="metro-count">—</b><em>metro bekati</em></p></div><p id="metro-insight">Metro ma’lumoti yuklanmoqda…</p></div>
				<div class="find-results"><div class="district-summary"><span>MIJOZ TANLOVI SIMULYATSIYASI</span><strong id="find-district-name">—</strong><p id="find-district-summary">Hisoblanmoqda…</p><div><b id="find-population">—</b><small>Aholi</small><b id="find-density">—</b><small>odam/km²</small><b id="find-pois">—</b><small>Fast-food</small></div></div><div class="simulation-explainer"><strong>Simulyatsiyada nima sodir bo‘ladi?</strong><div><span>1</span><p><b>Hudud bo‘linadi</b>Tuman kichik olti burchakli qismlarga ajratiladi.</p></div><div><span>2</span><p><b>Har bir joy sinab ko‘riladi</b>Shu yerda yangi fast-food ochilsa, odamlar uni tanlash ehtimoli hisoblanadi.</p></div><div><span>3</span><p><b>Eng kuchli joylar saralanadi</b>Mijoz salohiyati, raqiblar va metroga piyoda masofa birgalikda solishtiriladi.</p></div></div><div class="huff-view"><div><button class="is-active" type="button" data-huff-view="opportunity">Eng yaxshi joylar</button><button type="button" data-huff-view="capture" disabled>Tanlangan joy ta’siri</button></div><p id="huff-view-note">Xaritadagi yorqin hududlar yangi fast-food uchun kuchliroq imkoniyatni bildiradi.</p></div><div class="candidate-impact is-hidden" id="candidate-impact"><span>TANLANGAN JOY NATIJASI</span><strong id="impact-score">—</strong><div><p><small>Bozor ulushi</small><b id="impact-share">—</b></p><p><small>Taxminiy mijozlar</small><b id="impact-population">—</b></p><p><small>Eng yaqin raqib</small><b id="impact-nearest">—</b></p></div><p id="impact-brands">Joy tanlanganda uning raqiblarga taxminiy ta’siri ko‘rsatiladi.</p></div><div class="candidate-list" id="candidate-list"></div><p class="model-note"><b>Ball formulasi:</b> 78% mijoz salohiyati + 22% metro qulayligi. Aholi hozircha tuman ichidagi kichik hududlarga teng taqsimlanadi. Natija biznes kafolati emas, lokatsiyalarni solishtirish signalidir.</p></div>
				<div class="report-section territory-section analysis-only"><div><h3>Taxminiy xizmat hududi</h3><span>Eng yaqin nuqta modeli</span></div><div class="territory-card"><div class="territory-primary"><span>Yangi lokatsiya maydoni</span><strong id="candidate-area">—</strong><small id="territory-share">Umumiy maydonning —</small></div><div class="territory-stats"><p><span>Tanlangan radius</span><b id="analysis-area">—</b></p><p><span>Raqiblar o‘rtachasi</span><b id="average-area">—</b></p><p><span>O‘rtachadan farqi</span><b id="area-comparison">—</b></p></div><div class="territory-bars"><div><span>Yangi nuqta</span><i><em id="candidate-area-bar"></em></i><b id="candidate-area-label">—</b></div><div><span>Raqib o‘rtachasi</span><i><em id="average-area-bar"></em></i><b id="average-area-label">—</b></div></div></div><div class="territory-note" id="territory-insight">Xizmat hududi raqobatchilargacha bo‘lgan to‘g‘ri chiziq masofasi asosida hisoblanadi.</div><div class="territory-explainer"><strong>Bu raqam qanday chiqdi?</strong><ol><li><span>1</span><p><b>Eng yaqin nuqta</b>Hududdagi har bir joy eng yaqin fast-food’ga biriktiriladi.</p></li><li><span>2</span><p><b>Radius bilan kesish</b>Faqat siz tanlagan doira ichidagi maydon qoldiriladi.</p></li><li><span>3</span><p><b>Raqib bilan solishtirish</b>Yangi hudud yaqin raqiblarning o‘rtacha maydoni bilan taqqoslanadi.</p></li></ol></div></div>
				<div class="report-section analysis-only"><div><h3>Masofa bo‘yicha zichlik</h3><span>Fast food POI</span></div><div class="signal-list"><p><i></i>500 metr ichida <b id="band-500">—</b></p><p><i></i>1 kilometr ichida <b id="band-1000">—</b></p><p><i></i>2 kilometr ichida <b id="band-2000">—</b></p></div></div>
				<div class="report-section analysis-only"><div><h3>Eng yaqin raqobatchi</h3></div><div class="empty-insight" id="nearest-competitor">Hisoblanmoqda…</div></div>
				<div class="report-section analysis-only"><div><h3>Tahlil izohi</h3></div><div class="empty-insight" id="competition-insight">Hozircha tahlil faqat fast-food raqobati signaliga asoslanadi.</div></div>
			</section>

			<section class="page-panel is-hidden" data-panel="page">
				<button class="close-page" type="button"><i data-lucide="x"></i></button><span class="eyebrow" id="page-eyebrow">WORKSPACE</span><h2 id="page-title">Hisobotlar</h2><p id="page-description"></p><div id="page-content"></div>
			</section>

			<div class="map-hint is-hidden"><span><i data-lucide="locate-fixed"></i></span> Xaritadan nuqtani tanlang</div>
			<div class="brand-filter is-hidden"><span><small>TARMOQ FILTRI</small><strong id="brand-filter-name">EVOS</strong><b id="brand-filter-count">0 ta filial</b></span><button type="button" aria-label="Tarmoq filtrini yopish"><i data-lucide="x"></i></button></div>
			<div class="territory-legend is-hidden"><strong>Xizmat hududi xaritasi</strong><p><i class="is-candidate"></i><span><b>Yangi lokatsiya</b>Sizning nuqtangiz eng yaqin bo‘lgan hudud</span></p><p><i class="is-competitor"></i><span><b>Raqib hududlari</b>Boshqa fast-food’lar yaqinroq bo‘lgan joylar</span></p><p><i class="is-generator"></i><span><b>Hudud markazi</b>Hududni yaratgan haqiqiy fast-food nuqtasi</span></p><p><i class="is-radius"></i><span><b>Tahlil chegarasi</b>Siz tanlagan radius doirasi</span></p></div>
			<div class="district-legend is-hidden"><strong id="map-score-legend">Joy imkoniyati</strong><p id="map-score-description">Har bir kichik hududda yangi fast-food ochish alohida hisoblangan.</p><i></i><span><small id="map-score-low">Past</small><small id="map-score-high">Yuqori</small></span></div>
			<a class="metro-attribution is-hidden" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Metro © OpenStreetMap contributors</a>
			<div class="map-tools"><button type="button" data-map-action="in" aria-label="Xaritani kattalashtirish"><i data-lucide="plus"></i></button><button type="button" data-map-action="out" aria-label="Xaritani kichraytirish"><i data-lucide="minus"></i></button></div>
		</main>
	` )

	createIcons( {
		icons: { ArrowLeft, ArrowLeftRight, ArrowRight, FileText, HelpCircle, Layers3, LocateFixed, MapPin, Minus, Plus, Search, Settings, Store, Target, UserRound, X },
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
	let metroFeatures = []
	let searchResults = []
	let activeSearchIndex = -1
	let activePopup
	let activePoiId
	let hoveredTerritoryId
	let territoryFeatures = []
	let districtFeatures = []
	let selectedDistrictId
	let candidateFeatures = []
	let opportunityFeatures = []
	let activeCandidateId
	let huffView = "opportunity"
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
	const districtLegend = get( ".district-legend" )
	const layersToggle = get( ".layers-toggle" )
	const layersPanel = get( ".layers-panel" )
	const metroAttribution = get( ".metro-attribution" )
	let poiLayerLoaded = false
	let metroLayerLoaded = false

	const hidePanels = () => [ workflow, report, page ].forEach( panel => panel.classList.add( "is-hidden" ) )
	const setActiveNav = view => root.querySelectorAll( ".nav-item" ).forEach( item => item.classList.toggle( "is-active", item.dataset.view === view ) )

	const clearSelection = () => {
		selectedPoint = null
		selectedPoiId = null
		selectedDistrictId = null
		isSelecting = false
		action.disabled = true
		get( "#selected-location" ).textContent = "Xaritani bosing"
		get( "#district-select" ).value = ""
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
		candidateFeatures = []
		opportunityFeatures = []
		activeCandidateId = null
		huffView = "opportunity"
		districtLegend.classList.add( "is-hidden" )
		map?.getSource( "location-candidates" )?.setData( featureCollection( [] ) )
		map?.getSource( "h3-opportunity" )?.setData( featureCollection( [] ) )
		map?.getSource( "metro-analysis-link" )?.setData( featureCollection( [] ) )
		if( map?.getLayer( "district-selected" ) ) {
			map.setFilter( "district-selected", [ "==", [ "get", "id" ], "" ] )
		}
		syncLayerControls()
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
		if( mode === "find" ) {
			layerSettings.districts = true
			saveLayerSettings()
			syncLayerControls()
			applyCustomLayerSettings()
		}
		get( ".district-field" ).classList.toggle( "is-hidden", mode !== "find" )
		get( ".step" ).classList.toggle( "is-hidden", mode === "find" )
		isSelecting = true
		hint.innerHTML = mode === "find" ? "<span><i data-lucide=\"map-pin\"></i></span> Tumanni xaritadan yoki ro‘yxatdan tanlang" : "<span><i data-lucide=\"locate-fixed\"></i></span> Xaritadan nuqtani tanlang"
		createIcons( { icons: { LocateFixed, MapPin }, attrs: { "stroke-width": 1.8 } } )
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
		setLayerVisibility( [ "metro-analysis-link-glow", "metro-analysis-link", "metro-station-glow", "metro-stations", "metro-station-labels", "metro-entrances" ], layerSettings.metro )
		setLayerVisibility( [ "demand-clusters-glow", "demand-clusters", "demand-cluster-count", "demand-points" ], layerSettings.demandGenerators )
		setLayerVisibility( [ "voronoi-analysis-fill", "voronoi-analysis-glow", "voronoi-analysis-line", "voronoi-site-glow", "voronoi-site-points" ], layerSettings.serviceAreas )
		setLayerVisibility( [ "district-fill", "district-line-glow", "district-line", "district-selected" ], layerSettings.districts )
		setLayerVisibility( [ "district-labels" ], layerSettings.districts && opportunityFeatures.length === 0 )
		setLayerVisibility( [ "location-candidate-glow", "location-candidates" ], candidateFeatures.length > 0 )
		setLayerVisibility( [ "h3-opportunity-fill", "h3-opportunity-line" ], layerSettings.opportunityMap && opportunityFeatures.length > 0 )
		territoryLegend.classList.toggle( "is-hidden", !layerSettings.serviceAreas || territoryFeatures.length === 0 )
		districtLegend.classList.toggle( "is-hidden", !layerSettings.opportunityMap || opportunityFeatures.length === 0 || territoryFeatures.length > 0 )
		metroAttribution.classList.toggle( "is-hidden", !layerSettings.metro || !metroLayerLoaded )
	}
	const syncLayerControls = () => get( ".layers-panel" ).querySelectorAll( "[data-layer-setting]" ).forEach( button => {
		const enabled = Boolean( layerSettings[ button.dataset.layerSetting ] )
		const unavailable = button.dataset.layerSetting === "serviceAreas"
			? territoryFeatures.length === 0
			: button.dataset.layerSetting === "opportunityMap" && opportunityFeatures.length === 0
		button.classList.toggle( "is-active", enabled && !unavailable )
		button.classList.toggle( "is-unavailable", unavailable )
		button.disabled = unavailable
		button.setAttribute( "aria-checked", String( enabled && !unavailable ) )
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
	const formatNumber = value => new Intl.NumberFormat( "uz-UZ" ).format( Math.round( Number( value ) || 0 ) )
	const getDistrictAt = lngLat => {
		const cursor = point( [ lngLat.lng, lngLat.lat ] )
		return districtFeatures.find( feature => booleanPointInPolygon( cursor, feature ) ) ?? null
	}
	const updateDistrictStats = () => {
		if( districtFeatures.length === 0 || poiFeatures.length === 0 ) {
			return
		}
		poiFeatures.forEach( feature => {
			const district = districtFeatures.find( item => booleanPointInPolygon( feature, item ) )
			feature.properties.districtId = district?.properties.id || null
			feature.properties.districtName = district?.properties.name || null
		} )
		districtFeatures.forEach( district => {
			const poiCount = poiFeatures.filter( feature => feature.properties.districtId === district.properties.id ).length
			const areaKm2 = Number( district.properties.area ) / 1000000
			const population = Number( district.properties.population )
			const populationDensity = population / areaKm2
			const poiDensity = poiCount / areaKm2
			const perCapita = poiCount / population * 10000
			Object.assign( district.properties, { poiCount, areaKm2, populationDensity, poiDensity, perCapita } )
		} )
		map?.getSource( "districts" )?.setData( featureCollection( districtFeatures ) )
		map?.getSource( "fast-food-poi" )?.setData( featureCollection( poiFeatures ) )
	}
	const selectDistrict = district => {
		selectedDistrictId = district.properties.id
		selectedPoint = null
		get( "#district-select" ).value = selectedDistrictId
		get( "#selected-location" ).textContent = district.properties.name
		action.disabled = false
		hint.classList.add( "is-hidden" )
		map.setFilter( "district-selected", [ "==", [ "get", "id" ], selectedDistrictId ] )
		map.fitBounds( bbox( district ), { padding: { top: 75, right: 75, bottom: 75, left: window.innerWidth > 800 ? 470 : 40 }, duration: 800 } )
	}
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
	const getMetroContext = ( location, localRadius = radius ) => {
		const stations = metroFeatures
			.map( feature => ( { feature, distance: distanceMeters( location, feature.geometry.coordinates ) } ) )
			.sort( ( first, second ) => first.distance - second.distance )
		const nearest = stations[ 0 ] ?? null
		const withinRadius = stations.filter( station => station.distance <= localRadius )
		const distanceScore = nearest ? Math.max( 0, 100 - nearest.distance / 20 ) : 0
		const accessScore = Math.min( 100, Math.round( distanceScore + Math.max( 0, withinRadius.length - 1 ) * 6 ) )

		return { nearest, withinRadius, accessScore }
	}
	const showMetroConnection = ( location, metro ) => {
		const features = metro.nearest ? [ {
			type: "Feature",
			geometry: { type: "LineString", coordinates: [ [ location.lng, location.lat ], metro.nearest.feature.geometry.coordinates ] },
			properties: { stationName: metro.nearest.feature.properties.name, distance: metro.nearest.distance },
		} ] : []
		map?.getSource( "metro-analysis-link" )?.setData( featureCollection( features ) )
	}
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
		const metro = getMetroContext( selectedPoint )
		showMetroConnection( selectedPoint, metro )
		const insight = pressureScore >= 70
			? "Bu hududda fast-food klasteri shakllangan. Talab signali bo‘lishi mumkin, ammo yangi biznes aniq format va kuchli differensiatsiya bilan kirishi kerak."
			: pressureScore >= 35
				? "Raqobat muvozanatli. Yaqin raqiblarning formati va yetakchi brend taklifidan farqlanish imkoniyati bor."
				: "Bevosita raqobat past. Bu imkoniyat bo‘lishi mumkin, lekin past zichlik talab yetarli degani emas — keyingi signallar bilan tekshirish kerak."

		get( "#competition-score" ).textContent = pressureScore
		get( "#competition-level" ).textContent = `${ pressureLevel } bosim`
		get( "#competition-summary" ).textContent = `${ radius / 1000 } km radiusda ${ withinRadius.length } ta raqobatchi aniqlandi.`
		get( "#competitor-count" ).textContent = withinRadius.length
		get( "#brand-count" ).textContent = brandCounts.size
		get( "#nearest-distance" ).textContent = nearest ? formatDistance( nearest.distance ) : "—"
		get( "#dominant-brand" ).textContent = dominantBrand ? `${ dominantBrand.name } · ${ dominantBrand.count }` : "—"
		get( "#metro-access-score" ).textContent = metro.nearest ? `${ metro.accessScore }/100` : "—"
		get( "#nearest-metro-name" ).textContent = metro.nearest?.feature.properties.name || "Bekat topilmadi"
		get( "#nearest-metro-distance" ).textContent = metro.nearest ? formatDistance( metro.nearest.distance ) : "—"
		get( "#metro-count" ).textContent = metro.withinRadius.length
		get( "#metro-insight" ).textContent = !metro.nearest
			? "Metro ma’lumoti mavjud emas; bu signal natijaga qo‘shilmadi."
			: metro.nearest.distance <= 500
				? `${ cleanName( metro.nearest.feature.properties.name ) } bekati piyoda borishga yaqin. Bu tushlik va kechki oqim uchun kuchli signal.`
				: metro.nearest.distance <= 1000
					? `${ cleanName( metro.nearest.feature.properties.name ) } bekati nisbatan yaqin. Piyoda yo‘li va ko‘cha kesishmalarini joyida tekshirish kerak.`
					: `Eng yaqin metro ${ formatDistance( metro.nearest.distance ) } masofada. Bu lokatsiyada metro asosiy mijoz oqimi bo‘la olmaydi.`
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
		const district = getDistrictAt( selectedPoint )
		if( district ) {
			const districtDensity = Number( district.properties.poiDensity ) || 0
			const localDensity = withinRadius.length / ( Math.PI * ( radius / 1000 ) ** 2 )
			const difference = districtDensity ? Math.round( ( localDensity / districtDensity - 1 ) * 100 ) : 0
			get( "#analysis-district" ).textContent = `${ district.properties.name } tumani`
			get( "#district-population" ).textContent = formatNumber( district.properties.population )
			get( "#district-pois" ).textContent = district.properties.poiCount
			get( "#district-per-capita" ).textContent = Number( district.properties.perCapita ).toFixed( 2 )
			get( "#district-comparison" ).textContent = `${ Math.abs( difference ) }% ${ difference >= 0 ? "yuqori" : "past" }`
		}
		else {
			get( "#analysis-district" ).textContent = "Toshkent chegarasidan tashqari"
			const districtMetricSelectors = [ "#district-population", "#district-pois", "#district-per-capita", "#district-comparison" ]
			districtMetricSelectors.forEach( selector => get( selector ).textContent = "—" )
		}
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
	const createDistrictPopup = ( district, lngLat ) => {
		activePopup?.remove()
		const properties = district.properties
		const content = document.createElement( "div" )
		content.className = "district-popup__content"
		content.innerHTML = `<span>TUMAN MA’LUMOTLARI</span><strong>${ properties.name }</strong><p>${ formatNumber( properties.population ) } aholi · ${ Number( properties.areaKm2 || 0 ).toFixed( 1 ) } km²</p><div><span><small>Fast-food</small><b>${ properties.poiCount ?? "—" }</b></span><span><small>10 000 aholiga</small><b>${ Number( properties.perCapita || 0 ).toFixed( 2 ) }</b></span><span><small>Aholi zichligi</small><b>${ formatNumber( properties.populationDensity ) }/km²</b></span></div><small class="district-popup__note">Bu tuman bo‘yicha umumiy statistika. Aniq kuchli joylarni ko‘rish uchun “Shu tumanda joy topish”ni bosing.</small>`
		const button = document.createElement( "button" )
		button.type = "button"
		button.textContent = "Shu tumanda joy topish"
		content.append( button )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 14, maxWidth: "350px", className: "district-popup" } )
			.setLngLat( lngLat ).setDOMContent( content ).addTo( map )
		button.addEventListener( "click", () => {
			activePopup.remove()
			startWorkflow( "find" )
			selectDistrict( district )
		} )
	}
	const showH3Popup = ( feature, lngLat ) => {
		activePopup?.remove()
		const properties = feature.properties
		const content = document.createElement( "div" )
		content.className = "h3-popup__content"
		content.innerHTML = huffView === "capture"
			? `<span>TANLANGAN JOY TA’SIRI</span><strong>${ properties.captureScore }%</strong><p>Ushbu kichik hududdagi taxminiy ${ formatNumber( properties.estimatedPopulation ) } aholining yangi fast-food’ni tanlash ehtimoli.</p><small>Foiz qancha yuqori bo‘lsa, yangi nuqta shu yerdan shuncha ko‘p mijoz jalb qilishi mumkin.</small>`
			: `<span>JOY IMKONIYATI</span><strong>${ properties.opportunityScore }/100</strong><p>Shu yerda fast-food ochish ssenariysi mijoz salohiyati, yaqin raqiblar va metro bilan hisoblandi.</p><small>Metro qulayligi: ${ properties.metroScore }/100${ properties.metroName ? ` · ${ formatDistance( properties.metroDistance ) }` : "" }.</small>`
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 10, maxWidth: "310px", className: "h3-popup" } )
			.setLngLat( lngLat ).setDOMContent( content ).addTo( map )
	}
	const getCandidateUtility = ( origin, coordinates ) => {
		const distance = distanceMeters( origin, coordinates )
		return distance > 5000 ? 0 : 1 / Math.max( 200, distance ) ** 2
	}
	const setHuffView = mode => {
		if( mode === "capture" && !activeCandidateId ) {
			return
		}
		huffView = mode
		opportunityFeatures.forEach( feature => feature.properties.displayScore = mode === "capture" ? feature.properties.captureScore : feature.properties.opportunityScore )
		map.getSource( "h3-opportunity" )?.setData( featureCollection( opportunityFeatures ) )
		root.querySelectorAll( "[data-huff-view]" ).forEach( button => button.classList.toggle( "is-active", button.dataset.huffView === mode ) )
		get( "#huff-view-note" ).textContent = mode === "capture"
			? "Yorqin hududlarda odamlarning tanlangan yangi fast-food’ga borish ehtimoli yuqoriroq."
			: "Xaritadagi yorqin hududlar yangi fast-food uchun kuchliroq imkoniyatni bildiradi."
		get( "#map-score-legend" ).textContent = mode === "capture" ? "Yangi joyni tanlash ehtimoli" : "Joy imkoniyati"
		get( "#map-score-description" ).textContent = mode === "capture" ? "Yorqin hududlarda yangi joy ko‘proq mijoz jalb qilishi mumkin." : "Har bir kichik hududda yangi fast-food ochish alohida hisoblangan."
		get( "#map-score-low" ).textContent = mode === "capture" ? "Past %" : "Band"
		get( "#map-score-high" ).textContent = mode === "capture" ? "Yuqori %" : "Imkoniyat"
	}
	const selectCandidateScenario = ( feature, focus = true ) => {
		activeCandidateId = feature.properties.id
		const coordinates = feature.geometry.coordinates
		showMetroConnection( { lng: coordinates[ 0 ], lat: coordinates[ 1 ] }, getMetroContext( { lng: coordinates[ 0 ], lat: coordinates[ 1 ] } ) )
		const brandLosses = new Map()
		opportunityFeatures.forEach( origin => {
			const originCenter = { lng: origin.properties.lng, lat: origin.properties.lat }
			const candidateUtility = getCandidateUtility( originCenter, coordinates )
			const existingUtility = origin.properties.existingUtility
			const totalUtility = existingUtility + candidateUtility
			const captureShare = totalUtility ? candidateUtility / totalUtility : 0
			origin.properties.captureScore = Math.round( captureShare * 100 )
			origin.properties.displayScore = origin.properties.captureScore
			origin.properties.captureShare = captureShare
			const capturedPopulation = origin.properties.estimatedPopulation * captureShare
			const nearbyPois = poiFeatures.filter( poi => distanceMeters( originCenter, poi.geometry.coordinates ) <= 5000 )
			nearbyPois.forEach( poi => {
				const distance = Math.max( 200, distanceMeters( originCenter, poi.geometry.coordinates ) )
				const utility = Number( poi.properties.huffAttractiveness || 1 ) / distance ** 2
				const loss = existingUtility ? capturedPopulation * utility / existingUtility : 0
				const brand = poi.properties.brandName || cleanName( poi.properties.name )
				brandLosses.set( brand, ( brandLosses.get( brand ) || 0 ) + loss )
			} )
		} )
		map.getSource( "h3-opportunity" ).setData( featureCollection( opportunityFeatures ) )
		get( "[data-huff-view='capture']" ).disabled = false
		setHuffView( "capture" )
		get( "#candidate-impact" ).classList.remove( "is-hidden" )
		get( "#impact-score" ).textContent = `#${ feature.properties.rank } · ${ feature.properties.score }/100`
		get( "#impact-share" ).textContent = `${ feature.properties.marketShare.toFixed( 1 ) }%`
		get( "#impact-population" ).textContent = `~${ formatNumber( feature.properties.servedPopulation ) }`
		get( "#impact-nearest" ).textContent = formatDistance( feature.properties.nearest )
		const affectedBrands = [ ...brandLosses.entries() ].sort( ( first, second ) => second[ 1 ] - first[ 1 ] ).slice( 0, 3 )
		get( "#impact-brands" ).textContent = affectedBrands.length
			? `Yangi joy ochilsa, eng ko‘p mijoz yo‘qotishi mumkin bo‘lgan brendlar: ${ affectedBrands.map( ( [ brand, population ] ) => `${ brand } (~${ formatNumber( population ) } kishi)` ).join( ", " ) }.`
			: "Ta’sirni hisoblash uchun yaqin raqib topilmadi."
		get( "#candidate-list" ).querySelectorAll( "button" ).forEach( button => button.classList.toggle( "is-active", button.dataset.candidateId === activeCandidateId ) )
		if( focus ) {
			map.easeTo( { center: coordinates, zoom: 14.5, duration: 800 } )
		}
	}
	const showCandidatePopup = feature => {
		activePopup?.remove()
		selectCandidateScenario( feature )
		const coordinates = feature.geometry.coordinates
		const content = document.createElement( "div" )
		content.className = "candidate-popup__content"
		const metroText = feature.properties.metroName ? `${ feature.properties.metroName } · ${ formatDistance( feature.properties.metroDistance ) }` : "Metro signali yo‘q"
		content.innerHTML = `<span>#${ feature.properties.rank } · TAVSIYA ETILGAN JOY</span><strong>${ feature.properties.score }/100</strong><p>Taxminiy bozor ulushi ${ feature.properties.marketShare.toFixed( 1 ) }% · ~${ formatNumber( feature.properties.servedPopulation ) } potensial mijoz</p><small>Metro: ${ metroText } · qulaylik ${ feature.properties.metroScore }/100</small>`
		const button = document.createElement( "button" )
		button.type = "button"
		button.textContent = "Bu nuqtani chuqur tahlil qilish"
		content.append( button )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 18, maxWidth: "330px", className: "candidate-popup" } )
			.setLngLat( coordinates ).setDOMContent( content ).addTo( map )
		button.addEventListener( "click", () => {
			activePopup.remove()
			startWorkflow( "analyze" )
			selectLocation( { lng: coordinates[ 0 ], lat: coordinates[ 1 ] } )
		} )
	}
	const findDistrictLocations = () => {
		const district = districtFeatures.find( feature => feature.properties.id === selectedDistrictId )
		if( !district ) {
			return
		}
		const brandCounts = new Map()
		poiFeatures.forEach( poi => {
			const brand = poi.properties.brandId || normalizeSearch( poi.properties.name )
			brandCounts.set( brand, ( brandCounts.get( brand ) || 0 ) + 1 )
		} )
		poiFeatures.forEach( poi => {
			const brand = poi.properties.brandId || normalizeSearch( poi.properties.name )
			poi.properties.huffAttractiveness = 0.72 + Number( poi.properties.confidence || 0.7 ) * 0.28 + Math.min( 20, brandCounts.get( brand ) || 1 ) * 0.02
		} )
		const cells = polygonToCells( district.geometry.coordinates, 9, true )
		const estimatedPopulation = Number( district.properties.population ) / Math.max( 1, cells.length )
		opportunityFeatures = cells.map( cell => {
			const [ lat, lng ] = cellToLatLng( cell )
			const originCenter = { lng, lat }
			const existingUtility = poiFeatures.reduce( ( sum, poi ) => {
				const distance = Math.max( 200, distanceMeters( originCenter, poi.geometry.coordinates ) )
				if( distance > 5000 ) {
					return sum
				}
				return sum + Number( poi.properties.huffAttractiveness || 1 ) / distance ** 2
			}, 0 )
			return {
				type: "Feature",
				geometry: { type: "Polygon", coordinates: [ cellToBoundary( cell, true ) ] },
				properties: { id: cell, lat, lng, estimatedPopulation, existingUtility, opportunityScore: 0, captureScore: 0, displayScore: 0 },
			}
		} )
		const scored = opportunityFeatures.map( origin => {
			const coordinates = [ origin.properties.lng, origin.properties.lat ]
			let servedPopulation = 0
			opportunityFeatures.forEach( demandCell => {
				const demandCenter = { lng: demandCell.properties.lng, lat: demandCell.properties.lat }
				const candidateUtility = getCandidateUtility( demandCenter, coordinates )
				const totalUtility = demandCell.properties.existingUtility + candidateUtility
				servedPopulation += totalUtility ? demandCell.properties.estimatedPopulation * candidateUtility / totalUtility : 0
			} )
			const center = { lng: coordinates[ 0 ], lat: coordinates[ 1 ] }
			const distances = poiFeatures.map( poi => distanceMeters( center, poi.geometry.coordinates ) ).sort( ( first, second ) => first - second )
			const metro = getMetroContext( center )
			return { origin, coordinates, servedPopulation, marketShare: servedPopulation / Number( district.properties.population ) * 100, nearby: distances.filter( distance => distance <= radius ).length, nearest: distances[ 0 ] ?? 5000, metro }
		} )
		const servedValues = scored.map( item => item.servedPopulation )
		const minimumServed = Math.min( ...servedValues )
		const servedRange = Math.max( 1, Math.max( ...servedValues ) - minimumServed )
		scored.forEach( item => {
			const demandScore = ( item.servedPopulation - minimumServed ) / servedRange * 100
			const combinedScore = demandScore * 0.78 + item.metro.accessScore * 0.22
			item.score = Math.round( 35 + combinedScore / 100 * 63 )
			item.demandScore = Math.round( demandScore )
			item.origin.properties.opportunityScore = item.score
			item.origin.properties.displayScore = item.score
			item.origin.properties.metroScore = item.metro.accessScore
			item.origin.properties.metroDistance = item.metro.nearest?.distance ?? null
			item.origin.properties.metroName = item.metro.nearest?.feature.properties.name || null
		} )
		scored.sort( ( first, second ) => second.score - first.score )
		candidateFeatures = []
		for( const item of scored ) {
			const feature = point( item.coordinates, { id: `candidate-${ item.origin.properties.id }`, score: item.score, demandScore: item.demandScore, nearby: item.nearby, nearest: item.nearest, servedPopulation: item.servedPopulation, marketShare: item.marketShare, district: district.properties.name, metroScore: item.metro.accessScore, metroDistance: item.metro.nearest?.distance ?? null, metroName: item.metro.nearest?.feature.properties.name || null } )
			const farEnough = candidateFeatures.every( candidate => distanceMeters( { lng: feature.geometry.coordinates[ 0 ], lat: feature.geometry.coordinates[ 1 ] }, candidate.geometry.coordinates ) >= 750 )
			if( farEnough ) {
				feature.properties.rank = candidateFeatures.length + 1
				candidateFeatures.push( feature )
			}
			if( candidateFeatures.length === 6 ) {
				break
			}
		}
		map.getSource( "h3-opportunity" ).setData( featureCollection( opportunityFeatures ) )
		map.getSource( "location-candidates" ).setData( featureCollection( candidateFeatures ) )
		layerSettings.opportunityMap = true
		saveLayerSettings()
		syncLayerControls()
		applyCustomLayerSettings()
		get( "#find-district-name" ).textContent = `${ district.properties.name } tumani`
		get( "#find-population" ).textContent = formatNumber( district.properties.population )
		get( "#find-density" ).textContent = formatNumber( district.properties.populationDensity )
		get( "#find-pois" ).textContent = district.properties.poiCount
		get( "#find-district-summary" ).textContent = `Tuman ${ opportunityFeatures.length } ta kichik hududga bo‘lindi. Mijoz salohiyati 78%, metro qulayligi 22% vazn bilan hisoblanib, ${ candidateFeatures.length } ta eng kuchli joy ajratildi.`
		get( "#map-score-legend" ).textContent = "Joy imkoniyati"
		get( "#map-score-description" ).textContent = "Har bir kichik hududda yangi fast-food ochish alohida hisoblangan."
		get( "#map-score-low" ).textContent = "Band"
		get( "#map-score-high" ).textContent = "Imkoniyat"
		get( "#candidate-impact" ).classList.add( "is-hidden" )
		get( "[data-huff-view='capture']" ).disabled = true
		setHuffView( "opportunity" )
		const list = get( "#candidate-list" )
		list.replaceChildren()
		candidateFeatures.forEach( feature => {
			const button = document.createElement( "button" )
			button.type = "button"
			button.dataset.candidateId = feature.properties.id
			const metroLabel = feature.properties.metroName ? `metro ${ formatDistance( feature.properties.metroDistance ) }` : "metro signali yo‘q"
			button.innerHTML = `<span>${ feature.properties.rank }</span><div><strong>${ feature.properties.score } ball · ${ feature.properties.marketShare.toFixed( 1 ) }% bozor ulushi</strong><small>~${ formatNumber( feature.properties.servedPopulation ) } potensial mijoz · ${ feature.properties.nearby } ta raqib · ${ metroLabel }</small></div><b>Ko‘rish</b>`
			button.addEventListener( "click", () => {
				showCandidatePopup( feature )
			} )
			list.append( button )
		} )
		map.fitBounds( bbox( district ), { padding: { top: 70, right: window.innerWidth > 800 ? 560 : 35, bottom: 70, left: 70 }, duration: 900 } )
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
	const showMetroPopup = ( feature, coordinates ) => {
		activePopup?.remove()
		const properties = feature.properties
		const content = document.createElement( "div" )
		const eyebrow = document.createElement( "span" )
		const name = document.createElement( "strong" )
		const description = document.createElement( "p" )
		const source = document.createElement( "small" )
		content.className = "metro-popup__content"
		eyebrow.textContent = properties.stationName ? "METRO KIRISHI" : "METRO BEKATI"
		name.textContent = properties.stationName || properties.name || "Metro kirishi"
		description.textContent = properties.stationName
			? `${ properties.ref ? `${ properties.ref }-kirish · ` : "" }Bekat markazigacha ${ properties.distanceToStationCenter ?? "—" } m`
			: `${ properties.entranceCount || 0 } ta kirish nuqtasi${ properties.wheelchair !== "unknown" ? ` · Nogironlar aravachasi: ${ properties.wheelchair === "yes" ? "mos" : "cheklangan" }` : "" }`
		source.textContent = "Manba: OpenStreetMap contributors"
		content.append( eyebrow, name, description, source )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 16, maxWidth: "320px", className: "metro-popup" } )
			.setLngLat( coordinates ).setDOMContent( content ).addTo( map )
	}
	const showDemandPopup = ( feature, coordinates ) => {
		activePopup?.remove()
		const properties = feature.properties
		const content = document.createElement( "div" )
		const eyebrow = document.createElement( "span" )
		const name = document.createElement( "strong" )
		const description = document.createElement( "p" )
		const score = document.createElement( "small" )
		content.className = "demand-popup__content"
		eyebrow.textContent = `${ properties.categoryLabel } · TALAB GENERATORI`
		name.textContent = properties.name
		description.textContent = `Asosiy auditoriya: ${ { students: "talabalar va o‘quvchilar", shoppers: "xaridorlar", commuters: "yo‘lovchilar", workers: "xodimlar", visitors: "tashrif buyuruvchilar", travelers: "sayohatchilar" }[ properties.audience ] || "tashrif buyuruvchilar" }.`
		score.textContent = `Boshlang‘ich ta’sir koeffitsiyenti: ${ Math.round( Number( properties.weight ) * 100 ) }/100`
		content.append( eyebrow, name, description, score )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 16, maxWidth: "320px", className: "demand-popup" } )
			.setLngLat( coordinates ).setDOMContent( content ).addTo( map )
	}
	const loadDemandLayer = async() => {
		try {
			const response = await fetch( "/data/demand-generators.geojson" )
			if( !response.ok ) {
				throw new Error( `Demand generator data request failed: ${ response.status }` )
			}
			map.getSource( "demand-generators" ).setData( await response.json() )
			applyCustomLayerSettings()
		}
		catch( error ) {
			console.error( error )
		}
	}

	const loadMetroLayer = async() => {
		try {
			const [ stationsResponse, entrancesResponse ] = await Promise.all( [
				fetch( "/data/metro-stations.geojson" ),
				fetch( "/data/metro-entrances.geojson" ),
			] )
			if( !stationsResponse.ok || !entrancesResponse.ok ) {
				throw new Error( `Metro data request failed: ${ stationsResponse.status }/${ entrancesResponse.status }` )
			}
			const [ stations, entrances ] = await Promise.all( [ stationsResponse.json(), entrancesResponse.json() ] )
			metroFeatures = stations.features
			map.getSource( "metro-stations" ).setData( stations )
			map.getSource( "metro-entrances" ).setData( entrances )
			metroLayerLoaded = true
			applyCustomLayerSettings()
		}
		catch( error ) {
			console.error( error )
		}
	}

	const loadBoundaryData = async() => {
		try {
			const response = await fetch( "/data/boundaries.geojson" )
			if( !response.ok ) {
				throw new Error( `Boundary data request failed: ${ response.status }` )
			}
			const data = await response.json()
			districtFeatures = data.features.filter( feature => feature.geometry.type === "Polygon" && feature.properties.name )
			map.getSource( "districts" ).setData( featureCollection( districtFeatures ) )
			const select = get( "#district-select" )
			districtFeatures.sort( ( first, second ) => first.properties.name.localeCompare( second.properties.name, "uz" ) ).forEach( district => {
				const option = document.createElement( "option" )
				option.value = district.properties.id
				option.textContent = district.properties.name
				select.append( option )
			} )
			updateDistrictStats()
		}
		catch( error ) {
			console.error( error )
		}
	}

	const loadPoiLayer = async() => {
		try {
			const response = await fetch( "/data/fast-food-final.geojson" )
			if( !response.ok ) {
				throw new Error( `POI data request failed: ${ response.status }` )
			}

			const data = await response.json()
			poiFeatures = data.features
			updateDistrictStats()
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
		map.addSource( "districts", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "metro-stations", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "metro-entrances", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "metro-analysis-link", { type: "geojson", data: featureCollection( [] ) } )
		map.addSource( "demand-generators", { type: "geojson", data: featureCollection( [] ), promoteId: "id", cluster: true, clusterMaxZoom: 14, clusterRadius: 42 } )
		map.addSource( "h3-opportunity", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "location-candidates", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "selection-radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } } )
		map.addSource( "voronoi-analysis", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addSource( "voronoi-sites", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addLayer( { id: "district-fill", type: "fill", source: "districts", paint: { "fill-color": "#168bd4", "fill-opacity": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 0.14, 13, 0.08, 15, 0.04 ], "fill-emissive-strength": 0.35 } } )
		map.addLayer( { id: "district-line-glow", type: "line", source: "districts", paint: { "line-color": "#2aaeff", "line-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 6, 14, 10 ], "line-blur": 5, "line-opacity": 0.45, "line-emissive-strength": 2.2 } } )
		map.addLayer( { id: "district-line", type: "line", source: "districts", paint: { "line-color": "#9bdcff", "line-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 1.8, 14, 3 ], "line-opacity": 0.92, "line-emissive-strength": 2 } } )
		map.addLayer( { id: "district-selected", type: "line", source: "districts", filter: [ "==", [ "get", "id" ], "" ], paint: { "line-color": "#ffffff", "line-width": 5, "line-blur": 0.3, "line-opacity": 1, "line-emissive-strength": 2.5 } } )
		map.addLayer( { id: "district-labels", type: "symbol", source: "districts", minzoom: 9, layout: { "text-field": [ "get", "name" ], "text-size": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 11, 13, 14 ], "text-anchor": "center", "text-allow-overlap": false }, paint: { "text-color": "#e9f8ff", "text-halo-color": "rgba(4, 13, 24, 0.9)", "text-halo-width": 2, "text-halo-blur": 1, "text-emissive-strength": 1.6 } } )
		map.addLayer( { id: "h3-opportunity-fill", type: "fill", source: "h3-opportunity", layout: { visibility: "none" }, paint: { "fill-color": [ "interpolate", [ "linear" ], [ "get", "displayScore" ], 0, "#a72f58", 35, "#793b79", 55, "#40588f", 75, "#087fb8", 90, "#3de0ff", 100, "#e9fcff" ], "fill-opacity": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 0.58, 14, 0.74 ], "fill-emissive-strength": 1.15 } } )
		map.addLayer( { id: "h3-opportunity-line", type: "line", source: "h3-opportunity", layout: { visibility: "none" }, paint: { "line-color": "#8bdcff", "line-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 0.35, 14, 1.1 ], "line-opacity": 0.5, "line-emissive-strength": 1.3 } } )
		map.addLayer( { id: "selection-radius-fill", type: "fill", source: "selection-radius", paint: { "fill-color": "#2388ff", "fill-opacity": 0.035, "fill-emissive-strength": 0.25 } } )
		map.addLayer( { id: "voronoi-analysis-fill", type: "fill", source: "voronoi-analysis", paint: { "fill-color": [ "match", [ "get", "kind" ], "candidate", "#009dff", "#315f91" ], "fill-opacity": [ "case", [ "boolean", [ "feature-state", "hover" ], false ], [ "match", [ "get", "kind" ], "candidate", 0.78, 0.55 ], [ "match", [ "get", "kind" ], "candidate", 0.62, 0.34 ] ], "fill-emissive-strength": 1.2 } } )
		map.addLayer( { id: "voronoi-analysis-glow", type: "line", source: "voronoi-analysis", filter: [ "==", [ "get", "kind" ], "candidate" ], paint: { "line-color": "#00a8ff", "line-width": 14, "line-blur": 8, "line-opacity": 0.9, "line-emissive-strength": 3 } } )
		map.addLayer( { id: "voronoi-analysis-line", type: "line", source: "voronoi-analysis", paint: { "line-color": [ "match", [ "get", "kind" ], "candidate", "#e0f7ff", "#79b9ea" ], "line-width": [ "case", [ "boolean", [ "feature-state", "hover" ], false ], [ "match", [ "get", "kind" ], "candidate", 5, 3.5 ], [ "match", [ "get", "kind" ], "candidate", 4, 2 ] ], "line-opacity": [ "match", [ "get", "kind" ], "candidate", 1, 0.9 ], "line-emissive-strength": [ "match", [ "get", "kind" ], "candidate", 2.8, 1.35 ] } } )
		map.addLayer( { id: "voronoi-site-glow", type: "circle", source: "voronoi-sites", paint: { "circle-color": [ "match", [ "get", "kind" ], "candidate", "#00a8ff", "#7ca9dc" ], "circle-radius": [ "match", [ "get", "kind" ], "candidate", 17, 12 ], "circle-blur": 0.78, "circle-opacity": 0.72, "circle-emissive-strength": 2.5 } } )
		map.addLayer( { id: "voronoi-site-points", type: "circle", source: "voronoi-sites", paint: { "circle-color": [ "match", [ "get", "kind" ], "candidate", "#ffffff", "#d8e9fb" ], "circle-radius": [ "match", [ "get", "kind" ], "candidate", 8, 6 ], "circle-stroke-color": [ "match", [ "get", "kind" ], "candidate", "#00a8ff", "#547ca9" ], "circle-stroke-width": [ "match", [ "get", "kind" ], "candidate", 3, 2 ], "circle-emissive-strength": 2 } } )
		map.addLayer( { id: "selection-radius-glow", type: "line", source: "selection-radius", paint: { "line-color": "#168cff", "line-width": 7, "line-blur": 5, "line-opacity": 0.38, "line-emissive-strength": 1.8 } } )
		map.addLayer( { id: "selection-radius-line", type: "line", source: "selection-radius", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#bcecff", "line-width": 3.5, "line-dasharray": [ 2, 1.6 ], "line-opacity": 1, "line-emissive-strength": 2.2 } } )
		map.addLayer( { id: "location-candidate-glow", type: "circle", source: "location-candidates", paint: { "circle-color": "#36c7ff", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 18, 15, 28 ], "circle-blur": 0.72, "circle-opacity": 0.72, "circle-emissive-strength": 3 } } )
		map.addLayer( { id: "location-candidates", type: "circle", source: "location-candidates", paint: { "circle-color": [ "interpolate", [ "linear" ], [ "get", "score" ], 50, "#4f85bd", 75, "#42c3ff", 95, "#e8fbff" ], "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 7, 15, 11 ], "circle-stroke-color": "#071525", "circle-stroke-width": 3, "circle-emissive-strength": 2.5 } } )
		map.addLayer( { id: "demand-clusters-glow", type: "circle", source: "demand-generators", filter: [ "has", "point_count" ], paint: { "circle-color": "#8a75ff", "circle-radius": [ "step", [ "get", "point_count" ], 18, 50, 25, 250, 34 ], "circle-blur": 0.72, "circle-opacity": 0.66, "circle-emissive-strength": 2.7 } } )
		map.addLayer( { id: "demand-clusters", type: "circle", source: "demand-generators", filter: [ "has", "point_count" ], paint: { "circle-color": [ "step", [ "get", "point_count" ], "#4b64bd", 50, "#6759d4", 250, "#845ee8" ], "circle-radius": [ "step", [ "get", "point_count" ], 12, 50, 17, 250, 23 ], "circle-stroke-color": "#d9d4ff", "circle-stroke-width": 1.5, "circle-emissive-strength": 2 } } )
		map.addLayer( { id: "demand-cluster-count", type: "symbol", source: "demand-generators", filter: [ "has", "point_count" ], layout: { "text-field": [ "get", "point_count_abbreviated" ], "text-size": 10 }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(24, 17, 55, .7)", "text-halo-width": 1, "text-emissive-strength": 1.6 } } )
		map.addLayer( { id: "demand-points", type: "circle", source: "demand-generators", filter: [ "!", [ "has", "point_count" ] ], paint: { "circle-color": [ "match", [ "get", "category" ], "education", "#9b7cff", "office", "#4f9cff", "retail", "#ff6fb5", "transport", "#55e4ff", "healthcare", "#52d99a", "leisure", "#ffad5c", "hotel", "#d7c3ff", "#8ea5bd" ], "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 11, 4, 16, 7 ], "circle-stroke-color": "#f4f8ff", "circle-stroke-width": 1.2, "circle-opacity": 0.92, "circle-emissive-strength": 2.2 } } )
		map.addLayer( { id: "metro-analysis-link-glow", type: "line", source: "metro-analysis-link", paint: { "line-color": "#52dcff", "line-width": 10, "line-blur": 7, "line-opacity": 0.55, "line-emissive-strength": 2.8 } } )
		map.addLayer( { id: "metro-analysis-link", type: "line", source: "metro-analysis-link", layout: { "line-cap": "round" }, paint: { "line-color": "#c4f6ff", "line-width": 2.5, "line-dasharray": [ 2, 1.5 ], "line-opacity": 0.95, "line-emissive-strength": 2.2 } } )
		map.addLayer( { id: "metro-station-glow", type: "circle", source: "metro-stations", minzoom: 9, paint: { "circle-color": "#50d7ff", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 10, 13, 16, 16, 22 ], "circle-blur": 0.72, "circle-opacity": 0.8, "circle-emissive-strength": 3 } } )
		map.addLayer( { id: "metro-stations", type: "circle", source: "metro-stations", minzoom: 9, paint: { "circle-color": "#071522", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 4.5, 13, 7, 16, 9 ], "circle-stroke-color": "#8be8ff", "circle-stroke-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 2, 15, 3 ], "circle-emissive-strength": 2.4 } } )
		map.addLayer( { id: "metro-entrances", type: "circle", source: "metro-entrances", minzoom: 14, paint: { "circle-color": "#dffaff", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 14, 3, 17, 5 ], "circle-stroke-color": "#168ee8", "circle-stroke-width": 1.5, "circle-emissive-strength": 2 } } )
		map.addLayer( { id: "metro-station-labels", type: "symbol", source: "metro-stations", minzoom: 11, layout: { "text-field": [ "get", "name" ], "text-size": [ "interpolate", [ "linear" ], [ "zoom" ], 11, 10, 15, 12 ], "text-offset": [ 0, 1.25 ], "text-anchor": "top", "text-allow-overlap": false, "text-padding": 8 }, paint: { "text-color": "#dff8ff", "text-halo-color": "rgba(3, 12, 22, 0.96)", "text-halo-width": 2, "text-halo-blur": 1, "text-emissive-strength": 1.8 } } )
		map.on( "click", event => {
			if( isSelecting ) {
				if( activeWorkflow === "find" ) {
					const district = getDistrictAt( event.lngLat )
					if( district ) {
						selectDistrict( district )
					}
				}
				else {
					selectLocation( event.lngLat )
				}
				return
			}
			const territoryFeature = getTerritoryAt( event.lngLat )
			if( territoryFeature ) {
				createTerritoryPopup( territoryFeature.properties, event.lngLat )
			}
		} )
		map.on( "click", "district-fill", event => {
			if( !isSelecting && territoryFeatures.length === 0 && opportunityFeatures.length === 0 ) {
				const district = districtFeatures.find( feature => feature.properties.id === event.features[ 0 ].properties.id )
				if( district ) {
					createDistrictPopup( district, event.lngLat )
				}
			}
		} )
		map.on( "click", "location-candidates", event => {
			const feature = candidateFeatures.find( candidate => candidate.properties.id === event.features[ 0 ].properties.id )
			if( feature ) {
				showCandidatePopup( feature )
			}
		} )
		map.on( "click", "metro-stations", event => showMetroPopup( event.features[ 0 ], event.features[ 0 ].geometry.coordinates ) )
		map.on( "click", "metro-entrances", event => showMetroPopup( event.features[ 0 ], event.features[ 0 ].geometry.coordinates ) )
		map.on( "click", "demand-points", event => showDemandPopup( event.features[ 0 ], event.features[ 0 ].geometry.coordinates ) )
		map.on( "click", "demand-clusters", event => map.easeTo( { center: event.features[ 0 ].geometry.coordinates, zoom: Math.min( 16, map.getZoom() + 2 ), duration: 500 } ) )
		map.on( "click", "h3-opportunity-fill", event => {
			if( map.queryRenderedFeatures( event.point, { layers: [ "location-candidates" ] } ).length === 0 ) {
				showH3Popup( event.features[ 0 ], event.lngLat )
			}
		} )
		;[ "district-fill", "h3-opportunity-fill", "location-candidates", "metro-stations", "metro-entrances", "demand-points", "demand-clusters" ].forEach( layerId => {
			map.on( "mouseenter", layerId, () => map.getCanvas().style.cursor = "pointer" )
			map.on( "mouseleave", layerId, () => map.getCanvas().style.cursor = "default" )
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
		loadBoundaryData()
		loadMetroLayer()
		loadDemandLayer()
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
	get( "#district-select" ).addEventListener( "change", event => {
		const district = districtFeatures.find( feature => feature.properties.id === event.target.value )
		if( district ) {
			selectDistrict( district )
		}
		else {
			action.disabled = true
		}
	} )
	root.querySelectorAll( "[data-huff-view]" ).forEach( button => button.addEventListener( "click", () => setHuffView( button.dataset.huffView ) ) )

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
		hidePanels()
		report.classList.remove( "is-hidden" )
		report.classList.toggle( "is-find-report", activeWorkflow === "find" )
		layerSettings.metro = true
		saveLayerSettings()
		syncLayerControls()
		if( activeWorkflow === "find" ) {
			territoryLegend.classList.add( "is-hidden" )
			findDistrictLocations()
			const district = districtFeatures.find( feature => feature.properties.id === selectedDistrictId )
			get( "#report-title" ).textContent = "Tavsiya etilgan lokatsiyalar"
			get( "#report-location" ).textContent = `${ district.properties.name } · ${ radius / 1000 } km lokal radius`
		}
		else {
			layerSettings.serviceAreas = true
			saveLayerSettings()
			syncLayerControls()
			analyzeCompetition()
			syncLayerControls()
			applyCustomLayerSettings()
			territoryLegend.classList.remove( "is-hidden" )
			get( "#report-title" ).textContent = "Raqobat tahlili"
			get( "#report-location" ).textContent = `${ selectedPoint.lat.toFixed( 5 ) }, ${ selectedPoint.lng.toFixed( 5 ) } · ${ radius / 1000 } km`
		}
	} )
}
