import {
	ArrowLeft,
	ArrowLeftRight,
	ArrowRight,
	ChevronDown,
	FileText,
	Layers3,
	LocateFixed,
	MapPin,
	Search,
	Sparkles,
	X,
	createIcons,
} from "lucide"
import { cellToBoundary, cellToLatLng, polygonToCells } from "h3-js"
import { area, bbox, booleanPointInPolygon, circle, featureCollection, intersect, nearestPointOnLine, point, pointToLineDistance, voronoi } from "@turf/turf"
import { createComparisonAdvice, createLocationAdvice } from "../analysis/locationAdvisor.js"
import { createCompetitionModel, explainCompetitionThreat } from "../analysis/smartCompetition.js"

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
	compare: {
		label: "Lokatsiyalarni taqqoslash",
		title: "Ikki lokatsiyani belgilang",
		description: "A va B nuqtalarni xaritadan tanlang. Ikkalasi bir xil radiusda solishtiriladi.",
		action: "Lokatsiyalarni taqqoslash",
	},
}

const navItems = [
	[ "analyze", "map-pin", "Tahlil" ],
	[ "find", "search", "Joy topish" ],
	[ "reports", "file-text", "Hisobotlar" ],
	[ "compare", "arrow-left-right", "Taqqoslash" ],
]

const defaultLayerSettings = {
	fastFoodPoints: false,
	fastFoodHeatmap: false,
	metro: false,
	transitStops: false,
	demandGenerators: false,
	roadFlow: false,
	serviceAreas: true,
	districts: false,
	opportunityMap: true,
	placeLabels: true,
	roadLabels: true,
	poiLabels: false,
	transitLabels: false,
	objects3d: false,
}

const layerSettingsVersion = 2

const readLayerSettings = () => {
	try {
		const savedSettings = JSON.parse( localStorage.getItem( "ummon-layer-settings" ) || "{}" )
		if( Number( localStorage.getItem( "ummon-layer-settings-version" ) || 0 ) < layerSettingsVersion ) {
			const migratedSettings = { ...savedSettings, fastFoodPoints: false, fastFoodHeatmap: false, metro: false, transitStops: false, demandGenerators: false, roadFlow: false, districts: false, transitLabels: false, objects3d: false }
			localStorage.setItem( "ummon-layer-settings", JSON.stringify( migratedSettings ) )
			localStorage.setItem( "ummon-layer-settings-version", String( layerSettingsVersion ) )
			return { ...defaultLayerSettings, ...migratedSettings }
		}
		return { ...defaultLayerSettings, ...savedSettings }
	}
	catch {
		localStorage.setItem( "ummon-layer-settings-version", String( layerSettingsVersion ) )
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
			<nav class="top-nav" aria-label="Asosiy vositalar">${ navigation }</nav>
			<div class="map-search"><span><i data-lucide="search"></i></span><input type="search" placeholder="Fast food yoki manzilni qidiring" aria-label="Fast food qidirish" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"><kbd>⌘ K</kbd><div class="search-results" id="search-results" role="listbox" hidden></div></div>
			<div class="layer-control">
				<button class="layers-toggle" type="button" aria-expanded="false" aria-controls="layers-panel"><i data-lucide="layers-3"></i><span>Qatlamlar</span></button>
				<section class="layers-panel is-hidden" id="layers-panel" aria-label="Xarita qatlamlari">
					<header><div><span>XARITA SOZLAMALARI</span><strong>Qatlamlar</strong></div><button class="close-layers" type="button" aria-label="Qatlamlarni yopish"><i data-lucide="x"></i></button></header>
					<div class="layer-group"><b>Ummon data</b>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodPoints"><span><i class="layer-dot is-poi"></i><em>Fast-food nuqtalari<small>Restoran va tarmoq manzillari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="fastFoodHeatmap"><span><i class="layer-dot is-heatmap"></i><em>Zichlik heatmap’i<small>Fast-food klasterlari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="metro"><span><i class="layer-dot is-metro"></i><em>Metro bekatlari<small>Bekatlar va kirish nuqtalari</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="transitStops"><span><i class="layer-dot is-transit"></i><em>Avtobus bekatlari<small>1 403 ta tozalangan transport nuqtasi</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="demandGenerators"><span><i class="layer-dot is-demand"></i><em>Talab generatorlari<small>Ta’lim, ofis, savdo va boshqa oqimlar</small></em></span><i></i></button>
						<button class="layer-switch" type="button" role="switch" data-layer-setting="roadFlow"><span><i class="layer-dot is-road"></i><em>Yo‘l oqimi<small>Asosiy avtomobil yo‘llari va kuchi</small></em></span><i></i></button>
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
		</header>

		<main class="map-workspace">
			<div class="map-brand" aria-label="Ummon Location"><span><img src="/logo.png" alt=""></span><div><strong>Ummon</strong><small>Location Intelligence</small></div></div>
			<section class="workflow-panel is-hidden" data-panel="workflow">
				<div class="panel-top"><div><span class="eyebrow">YANGI TAHLIL</span><h2 id="workflow-title">Lokatsiyani belgilang</h2></div><button class="close-button" type="button"><i data-lucide="x"></i></button></div>
				<p id="workflow-description">Xaritadan fast food ochmoqchi bo‘lgan aniq nuqtani tanlang.</p>
				<div class="step"><span>1</span><div><small>NUQTA</small><strong id="selected-location">Xaritani bosing</strong></div></div>
				<div class="compare-picker is-hidden"><button type="button" data-compare-slot="a"><span>A</span><div><small>BIRINCHI JOY</small><strong id="compare-location-a">Xaritadan tanlang</strong></div></button><button type="button" data-compare-slot="b"><span>B</span><div><small>IKKINCHI JOY</small><strong id="compare-location-b">Xaritadan tanlang</strong></div></button><p id="compare-picker-help">Avval A lokatsiyani xaritadan belgilang.</p></div>
				<fieldset class="district-field is-hidden"><legend>Tumanni tanlang</legend><label class="select-wrap"><span><i data-lucide="map-pin"></i></span><select id="district-select"><option value="">Tuman tanlanmagan</option></select></label></fieldset>
				<fieldset><legend>2 &nbsp; Tahlil radiusi</legend><div class="segments" data-control="radius"><button type="button" data-value="500">500 m</button><button class="is-active" type="button" data-value="1000">1 km</button><button type="button" data-value="2000">2 km</button></div></fieldset>
				<button class="primary-action" id="primary-action" type="button" disabled><span>Tahlilni boshlash</span><b><i data-lucide="arrow-right"></i></b></button>
			</section>

			<section class="report-panel is-hidden" data-panel="report">
				<div class="report-head"><div><span class="eyebrow">REAL GEO ANALYTICS</span><h2 id="report-title">Raqobat tahlili</h2><small id="report-location">Tanlangan lokatsiya</small></div><button class="close-report" type="button"><i data-lucide="x"></i></button></div>
				<section class="ai-advisor"><header><span><i data-lucide="sparkles"></i> AI LOCATION ADVISOR</span><b id="ai-confidence">—</b></header><strong id="ai-verdict">Tahlil kutilmoqda</strong><p id="ai-format">Mos biznes formati aniqlanadi</p><div><article><small>KUCHLI TOMONLAR</small><ul id="ai-strengths"><li>Geo signallar hisoblanmoqda</li></ul></article><article><small>XAVFLAR</small><ul id="ai-risks"><li>Ma’lumot kutilmoqda</li></ul></article></div><footer><small>KEYINGI QADAM</small><p id="ai-action">Tahlildan keyin amaliy tavsiya chiqadi.</p></footer></section>
				<div class="district-context analysis-only"><span>TUMAN KONTEKSTI</span><strong id="analysis-district">Aniqlanmoqda…</strong><div><p><small>Aholi</small><b id="district-population">—</b></p><p><small>Fast-food</small><b id="district-pois">—</b></p><p><small>10 000 aholiga</small><b id="district-per-capita">—</b></p><p><small>Taqqoslash</small><b id="district-comparison">—</b></p></div></div>
				<div class="score-block analysis-only"><div class="score-ring"><strong id="competition-score">—</strong><small>/100</small></div><div><span>RAQOBAT BOSIMI</span><strong id="competition-level">Hisoblanmoqda</strong><p id="competition-summary">Radius ichidagi fast-food nuqtalari asosida.</p></div></div>
				<div class="metric-grid analysis-only"><article><span>Raqobatchilar</span><strong id="competitor-count">—</strong></article><article><span>Tarmoq brendlari</span><strong id="brand-count">—</strong></article><article><span>Eng yaqin raqib</span><strong id="nearest-distance">—</strong></article><article><span>Yetakchi brend</span><strong id="dominant-brand">—</strong></article></div>
				<div class="metro-analysis analysis-only"><div><span>METRO QULAYLIGI</span><strong id="metro-access-score">—</strong></div><div><p><small>Eng yaqin bekat</small><b id="nearest-metro-name">—</b><em id="nearest-metro-distance">—</em></p><p><small>Radius ichida</small><b id="metro-count">—</b><em>metro bekati</em></p></div><p id="metro-insight">Metro ma’lumoti yuklanmoqda…</p></div>
				<div class="transit-analysis analysis-only"><div><span>AVTOBUS QULAYLIGI</span><strong id="transit-access-score">—</strong></div><div><p><small>Eng yaqin bekat</small><b id="nearest-transit-name">—</b><em id="nearest-transit-distance">—</em></p><p><small>800 metr ichida</small><b id="transit-count">—</b><em>noyob bekat</em></p></div><p id="transit-insight">Avtobus bekatlari hisoblanmoqda…</p></div>
				<div class="demand-analysis analysis-only"><div><span>TALAB OQIMI POTENSIALI</span><strong id="demand-access-score">—</strong></div><div><p><small>Radius ichida</small><b id="demand-nearby-count">—</b><em>talab generatori</em></p><p><small>Kuchli auditoriya</small><b id="demand-leading-category">—</b><em id="demand-strongest-place">—</em></p></div><p id="demand-insight">Talab generatorlari hisoblanmoqda…</p></div>
				<div class="road-analysis analysis-only"><div><span>YO‘L OQIMI POTENSIALI</span><strong id="road-access-score">—</strong></div><div><p><small>Eng yaqin asosiy yo‘l</small><b id="nearest-road-name">—</b><em id="nearest-road-distance">—</em></p><p><small>Yo‘l klassi</small><b id="nearest-road-class">—</b><em id="nearest-road-details">—</em></p></div><p id="road-insight">Yo‘l tarmog‘i hisoblanmoqda…</p></div>
				<div class="find-results"><div class="district-summary"><span>MIJOZ TANLOVI SIMULYATSIYASI</span><strong id="find-district-name">—</strong><p id="find-district-summary">Hisoblanmoqda…</p><div><b id="find-population">—</b><small>Aholi</small><b id="find-density">—</b><small>odam/km²</small><b id="find-pois">—</b><small>Fast-food</small></div></div><div class="simulation-explainer"><strong>Simulyatsiyada nima sodir bo‘ladi?</strong><div><span>1</span><p><b>Hudud bo‘linadi</b>Tuman kichik olti burchakli qismlarga ajratiladi.</p></div><div><span>2</span><p><b>Har bir joy sinab ko‘riladi</b>Shu yerda yangi fast-food ochilsa, odamlar uni tanlash ehtimoli hisoblanadi.</p></div><div><span>3</span><p><b>Eng kuchli joylar saralanadi</b>Mijoz salohiyati, talab generatorlari, metro, avtobus va asosiy yo‘llar birgalikda solishtiriladi.</p></div></div><div class="huff-view"><div><button class="is-active" type="button" data-huff-view="opportunity">Eng yaxshi joylar</button><button type="button" data-huff-view="capture" disabled>Tanlangan joy ta’siri</button></div><p id="huff-view-note">Xaritadagi yorqin hududlar yangi fast-food uchun kuchliroq imkoniyatni bildiradi.</p></div><div class="candidate-impact is-hidden" id="candidate-impact"><span>TANLANGAN JOY NATIJASI</span><strong id="impact-score">—</strong><div><p><small>Bozor ulushi</small><b id="impact-share">—</b></p><p><small>Taxminiy mijozlar</small><b id="impact-population">—</b></p><p><small>Eng yaqin raqib</small><b id="impact-nearest">—</b></p></div><p id="impact-brands">Joy tanlanganda uning raqiblarga taxminiy ta’siri ko‘rsatiladi.</p></div><div class="candidate-list" id="candidate-list"></div><p class="model-note"><b>Ball formulasi:</b> 40% mijoz salohiyati + 20% talab oqimi + 15% metro + 15% avtobus + 10% yo‘l oqimi. Transport ballari bekatgacha masofa va yaqin bekatlar sonidan olinadi.</p></div>
				<div class="report-section territory-section analysis-only"><div><h3>Taxminiy xizmat hududi</h3><span>Eng yaqin nuqta modeli</span></div><div class="territory-card"><div class="territory-primary"><span>Yangi lokatsiya maydoni</span><strong id="candidate-area">—</strong><small id="territory-share">Umumiy maydonning —</small></div><div class="territory-stats"><p><span>Tanlangan radius</span><b id="analysis-area">—</b></p><p><span>Raqiblar o‘rtachasi</span><b id="average-area">—</b></p><p><span>O‘rtachadan farqi</span><b id="area-comparison">—</b></p></div><div class="territory-bars"><div><span>Yangi nuqta</span><i><em id="candidate-area-bar"></em></i><b id="candidate-area-label">—</b></div><div><span>Raqib o‘rtachasi</span><i><em id="average-area-bar"></em></i><b id="average-area-label">—</b></div></div></div><div class="territory-note" id="territory-insight">Xizmat hududi raqobatchilargacha bo‘lgan to‘g‘ri chiziq masofasi asosida hisoblanadi.</div><div class="territory-explainer"><strong>Bu raqam qanday chiqdi?</strong><ol><li><span>1</span><p><b>Eng yaqin nuqta</b>Hududdagi har bir joy eng yaqin fast-food’ga biriktiriladi.</p></li><li><span>2</span><p><b>Radius bilan kesish</b>Faqat siz tanlagan doira ichidagi maydon qoldiriladi.</p></li><li><span>3</span><p><b>Raqib bilan solishtirish</b>Yangi hudud yaqin raqiblarning o‘rtacha maydoni bilan taqqoslanadi.</p></li></ol></div></div>
				<div class="report-section analysis-only"><div><h3>Masofa bo‘yicha zichlik</h3><span>Fast food POI</span></div><div class="signal-list"><p><i></i>500 metr ichida <b id="band-500">—</b></p><p><i></i>1 kilometr ichida <b id="band-1000">—</b></p><p><i></i>2 kilometr ichida <b id="band-2000">—</b></p></div></div>
				<div class="report-section analysis-only"><div><h3>Eng yaqin raqobatchi</h3></div><div class="empty-insight" id="nearest-competitor">Hisoblanmoqda…</div></div>
				<div class="report-section analysis-only"><div><h3>Tahlil izohi</h3></div><div class="empty-insight" id="competition-insight">Hozircha tahlil faqat fast-food raqobati signaliga asoslanadi.</div></div>
				<button class="save-report-button" id="save-analysis-report" type="button" disabled><span><i data-lucide="file-text"></i> Hisobotni saqlash</span><b>Hisobotlar</b></button>
			</section>

			<section class="page-panel is-hidden" data-panel="page">
				<button class="close-page" type="button"><i data-lucide="x"></i></button><span class="eyebrow" id="page-eyebrow">WORKSPACE</span><h2 id="page-title">Hisobotlar</h2><p id="page-description"></p><div id="page-content"></div>
			</section>
			<section class="comparison-panel is-hidden" data-panel="comparison">
				<div class="comparison-head"><div><span class="eyebrow">A / B TAQQOSLASH</span><h2>Qaysi lokatsiya kuchliroq?</h2><small id="comparison-radius">Bir xil radiusdagi signallar</small></div><button class="close-comparison" type="button"><i data-lucide="x"></i></button></div>
				<div class="comparison-verdict"><span><i data-lucide="sparkles"></i> AI TAVSIYASI</span><b id="comparison-ai-confidence">—</b><strong id="comparison-winner">Hisoblanmoqda…</strong><p id="comparison-summary">Ikki lokatsiyaning biznes signallari solishtirilmoqda.</p><small id="comparison-ai-risk">Asosiy xavf aniqlanadi.</small></div>
				<div class="comparison-columns"><article class="is-a"><header><span>A</span><div><small>BIRINCHI JOY</small><strong id="comparison-a-coordinate">—</strong></div><b id="comparison-a-score">—</b></header></article><article class="is-b"><header><span>B</span><div><small>IKKINCHI JOY</small><strong id="comparison-b-coordinate">—</strong></div><b id="comparison-b-score">—</b></header></article></div>
				<div class="comparison-metrics" id="comparison-metrics"></div>
				<p class="comparison-note">Umumiy ball: 40% raqobat imkoniyati, 20% talab, 15% metro, 15% avtobus va 10% yo‘l signali. Past raqobat bosimi afzal hisoblanadi.</p>
				<button class="save-report-button" id="save-comparison-report" type="button" disabled><span><i data-lucide="file-text"></i> Taqqoslashni saqlash</span><b>Hisobotlar</b></button>
			</section>

			<div class="map-hint is-hidden"><span><i data-lucide="locate-fixed"></i></span> Xaritadan nuqtani tanlang</div>
			<button class="focus-reset is-hidden" type="button"><i data-lucide="arrow-left"></i><span>Oldingi ko‘rinish</span></button>
			<div class="brand-filter is-hidden"><span><small>TARMOQ FILTRI</small><strong id="brand-filter-name">EVOS</strong><b id="brand-filter-count">0 ta filial</b></span><button type="button" aria-label="Tarmoq filtrini yopish"><i data-lucide="x"></i></button></div>
			<div class="territory-legend is-hidden"><header><strong>Xizmat hududi xaritasi</strong><button class="territory-legend-toggle" type="button" aria-label="Xizmat hududi izohini yig‘ish" aria-expanded="true"><i data-lucide="chevron-down"></i></button></header><div class="territory-legend-content"><p><i class="is-candidate"></i><span><b>Yangi lokatsiya</b>Sizning nuqtangiz eng yaqin bo‘lgan hudud</span></p><p><i class="is-competitor"></i><span><b>Raqib hududlari</b>Boshqa fast-food’lar yaqinroq bo‘lgan joylar</span></p><p><i class="is-generator"></i><span><b>Hudud markazi</b>Hududni yaratgan haqiqiy fast-food nuqtasi</span></p><p><i class="is-radius"></i><span><b>Tahlil chegarasi</b>Siz tanlagan radius doirasi</span></p></div></div>
			<div class="district-legend is-hidden"><strong id="map-score-legend">Joy imkoniyati</strong><i></i><span><small id="map-score-low">Past</small><small id="map-score-high">Yuqori</small></span></div>
		</main>
	` )

	createIcons( {
		icons: { ArrowLeft, ArrowLeftRight, ArrowRight, ChevronDown, FileText, Layers3, LocateFixed, MapPin, Search, Sparkles, X },
		attrs: { "stroke-width": 1.8 },
	} )

	let map
	let marker
	let compareMarkers = []
	let comparePoints = { a: null, b: null }
	let activeCompareSlot = "a"
	let pendingReport = null
	let pendingReportSaved = false
	let focusMode = null
	let focusCamera = null
	let analysisFocusPoiIds = []
	let radius = 1000
	let selectedPoint
	let selectedPoiId
	let activeWorkflow
	let isSelecting = false
	let poiFeatures = []
	let getSmartCompetition = null
	let metroFeatures = []
	let transitFeatures = []
	const transitSpatialIndex = new Map()
	let demandFeatures = []
	const demandSpatialIndex = new Map()
	let roadFeatures = []
	const roadSpatialIndex = new Map()
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
	const comparison = get( "[data-panel='comparison']" )
	const hint = get( ".map-hint" )
	const focusReset = get( ".focus-reset" )
	const action = get( "#primary-action" )
	const searchInput = get( ".map-search input" )
	const searchPanel = get( ".search-results" )
	const brandFilter = get( ".brand-filter" )
	const territoryLegend = get( ".territory-legend" )
	const territoryLegendToggle = get( ".territory-legend-toggle" )
	const districtLegend = get( ".district-legend" )
	const layersToggle = get( ".layers-toggle" )
	const layersPanel = get( ".layers-panel" )
	let poiLayerLoaded = false
	let metroLayerPromise
	let transitLayerPromise
	let demandLayerPromise
	let roadLayerPromise
	let poiLayerPromise
	const territoryLegendCollapsed = localStorage.getItem( "ummon-territory-legend-collapsed" ) === "true"
	territoryLegend.classList.toggle( "is-collapsed", territoryLegendCollapsed )
	territoryLegendToggle.setAttribute( "aria-expanded", String( !territoryLegendCollapsed ) )

	const hidePanels = () => [ workflow, report, page, comparison ].forEach( panel => panel.classList.add( "is-hidden" ) )
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
		compareMarkers.forEach( compareMarker => compareMarker.remove() )
		compareMarkers = []
		comparePoints = { a: null, b: null }
		activeCompareSlot = "a"
		get( "#compare-location-a" ).textContent = "Xaritadan tanlang"
		get( "#compare-location-b" ).textContent = "Xaritadan tanlang"
		get( "#compare-picker-help" ).textContent = "Avval A lokatsiyani xaritadan belgilang."
		root.querySelectorAll( "[data-compare-slot]" ).forEach( button => button.classList.toggle( "is-active", button.dataset.compareSlot === "a" ) )
		if( map?.getSource( "selection-radius" ) ) {
			map.getSource( "selection-radius" ).setData( { type: "FeatureCollection", features: [] } )
		}
		map?.getSource( "comparison-radius" )?.setData( featureCollection( [] ) )
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
		map?.getSource( "ai-evidence" )?.setData( featureCollection( [] ) )
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
	const selectCompareLocation = point => {
		comparePoints[ activeCompareSlot ] = { lng: point.lng, lat: point.lat }
		const slot = activeCompareSlot
		const previousMarker = compareMarkers.find( item => item.slot === slot )
		previousMarker?.marker.remove()
		compareMarkers = compareMarkers.filter( item => item.slot !== slot )
		const element = document.createElement( "div" )
		element.className = `compare-marker is-${ slot }`
		element.textContent = slot.toUpperCase()
		const compareMarker = new window.mapboxgl.Marker( { element, anchor: "center" } ).setLngLat( point ).addTo( map )
		compareMarkers.push( { slot, marker: compareMarker } )
		get( `#compare-location-${ slot }` ).textContent = `${ point.lat.toFixed( 5 ) }, ${ point.lng.toFixed( 5 ) }`
		if( slot === "a" && !comparePoints.b ) {
			activeCompareSlot = "b"
			get( "#compare-picker-help" ).textContent = "Endi B lokatsiyani xaritadan belgilang."
		}
		else {
			get( "#compare-picker-help" ).textContent = "Nuqtani almashtirish uchun A yoki B kartasini bosing."
		}
		root.querySelectorAll( "[data-compare-slot]" ).forEach( button => button.classList.toggle( "is-active", button.dataset.compareSlot === activeCompareSlot ) )
		action.disabled = !( comparePoints.a && comparePoints.b )
		updateRadius()
	}

	const startWorkflow = ( mode, { preserveFocus = false } = {} ) => {
		closeLayerPanel()
		activePopup?.remove()
		if( focusMode && !preserveFocus ) {
			exitFocusMode( false )
		}
		clearBrandMode()
		activeWorkflow = mode
		pendingReport = null
		pendingReportSaved = false
		root.querySelectorAll( ".save-report-button" ).forEach( button => button.disabled = true )
		const copy = workflows[ mode ]
		hidePanels()
		workflow.classList.remove( "is-hidden" )
		get( "#workflow-title" ).textContent = copy.title
		get( "#workflow-description" ).textContent = copy.description
		action.querySelector( "span" ).textContent = copy.action
		clearSelection()
		if( mode === "find" ) {
			enterFocusMode( "district", "Barcha qatlamlarni qaytarish" )
		}
		get( ".district-field" ).classList.toggle( "is-hidden", mode !== "find" )
		get( ".step" ).classList.toggle( "is-hidden", mode === "find" || mode === "compare" )
		get( ".compare-picker" ).classList.toggle( "is-hidden", mode !== "compare" )
		isSelecting = true
		hint.innerHTML = mode === "find" ? "<span><i data-lucide=\"map-pin\"></i></span> Tumanni xaritadan yoki ro‘yxatdan tanlang" : mode === "compare" ? "<span><i data-lucide=\"locate-fixed\"></i></span> A lokatsiyani belgilang" : "<span><i data-lucide=\"locate-fixed\"></i></span> Xaritadan nuqtani tanlang"
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
		if( focusMode ) {
			exitFocusMode( false )
		}
		clearSelection()
		clearBrandMode()
		setActiveNav( null )
		if( map ) {
			if( !poiLayerLoaded ) {
				await ( poiLayerPromise || loadPoiLayer() )
			}
			else {
				applyCustomLayerSettings()
			}
		}
	}

	const pageData = {
		reports: [ "HISOBOTLAR", "Mening hisobotlarim", "Saqlangan lokatsiya tahlillari shu yerda jamlanadi.", "Hali hisobot yo‘q", "Birinchi lokatsiyani tahlil qilganingizdan so‘ng hisobot shu yerda ko‘rinadi." ],
	}
	const reportsStorageKey = "ummon-analysis-reports"
	const readSavedReports = () => {
		try {
			const saved = JSON.parse( localStorage.getItem( reportsStorageKey ) || "[]" )
			return Array.isArray( saved ) ? saved : []
		}
		catch {
			return []
		}
	}
	const saveReport = reportData => {
		const reports = readSavedReports()
		reports.unshift( { id: `${ Date.now() }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`, createdAt: new Date().toISOString(), ...reportData } )
		localStorage.setItem( reportsStorageKey, JSON.stringify( reports.slice( 0, 50 ) ) )
	}
	const setPendingReport = reportData => {
		pendingReport = reportData
		pendingReportSaved = false
		root.querySelectorAll( ".save-report-button" ).forEach( button => {
			button.disabled = false
			button.classList.remove( "is-saved" )
			button.querySelector( "span" ).lastChild.textContent = button.id === "save-comparison-report" ? " Taqqoslashni saqlash" : " Hisobotni saqlash"
			button.querySelector( "b" ).textContent = "Hisobotlar"
		} )
	}
	const savePendingReport = button => {
		if( !pendingReport || pendingReportSaved ) {
			return
		}
		saveReport( pendingReport )
		pendingReportSaved = true
		button.disabled = true
		button.classList.add( "is-saved" )
		button.querySelector( "span" ).lastChild.textContent = " Saqlandi"
		button.querySelector( "b" ).textContent = "Hisobotlarda"
	}
	const escapeHtml = value => String( value ?? "" ).replace( /[&<>"]/g, character => ( { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" } )[ character ] )
	const renderSavedReports = () => {
		const reports = readSavedReports()
		const content = get( "#page-content" )
		if( !reports.length ) {
			content.innerHTML = "<div class=\"empty-state\"><span><i data-lucide=\"file-text\"></i></span><strong>Hali hisobot yo‘q</strong><p>Birinchi tahlil yakunlanganda natija avtomatik shu yerda saqlanadi.</p></div>"
			createIcons( { icons: { FileText }, attrs: { "stroke-width": 1.8 } } )
			return
		}
		content.innerHTML = `<div class="reports-toolbar"><span><b>${ reports.length }</b> ta saqlangan hisobot</span><button type="button" data-clear-reports>Barchasini o‘chirish</button></div><div class="saved-reports">${ reports.map( savedReport => {
			const date = new Intl.DateTimeFormat( "uz-UZ", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } ).format( new Date( savedReport.createdAt ) )
			return `<article><div class="report-type is-${ escapeHtml( savedReport.type ) }">${ escapeHtml( savedReport.typeLabel ) }</div><header><strong>${ escapeHtml( savedReport.title ) }</strong><button type="button" data-delete-report="${ escapeHtml( savedReport.id ) }" aria-label="Hisobotni o‘chirish"><i data-lucide="x"></i></button></header><p>${ escapeHtml( savedReport.summary ) }</p><div class="saved-report-metrics">${ ( savedReport.metrics || [] ).map( metric => `<span><small>${ escapeHtml( metric.label ) }</small><b>${ escapeHtml( metric.value ) }</b></span>` ).join( "" ) }</div><footer><span>${ escapeHtml( savedReport.location ) }</span><time>${ date }</time></footer></article>`
		} ).join( "" ) }</div>`
		createIcons( { icons: { X }, attrs: { "stroke-width": 1.8 } } )
		content.querySelector( "[data-clear-reports]" ).addEventListener( "click", () => {
			localStorage.removeItem( reportsStorageKey )
			renderSavedReports()
		} )
		content.querySelectorAll( "[data-delete-report]" ).forEach( button => button.addEventListener( "click", () => {
			localStorage.setItem( reportsStorageKey, JSON.stringify( readSavedReports().filter( savedReport => savedReport.id !== button.dataset.deleteReport ) ) )
			renderSavedReports()
		} ) )
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
		renderSavedReports()
		clearSelection()
		setActiveNav( view )
		if( poiLayerLoaded ) {
			setPoiLayerVisibility( "none" )
		}
	}

	const updateRadius = () => {
		if( map && activeWorkflow === "compare" && map.getSource( "comparison-radius" ) ) {
			const features = [ "a", "b" ].flatMap( slot => comparePoints[ slot ] ? [ { ...circleFeature( comparePoints[ slot ], radius ), properties: { slot } } ] : [] )
			map.getSource( "comparison-radius" ).setData( featureCollection( features ) )
			return
		}
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
	const focusLayerGroups = {
		poi: [ "fast-food-heatmap", "fast-food-point-glow", "fast-food-points" ],
		metro: [ "metro-analysis-link-glow", "metro-analysis-link", "metro-station-glow", "metro-stations", "metro-station-labels", "metro-entrances" ],
		transit: [ "transit-stop-glow", "transit-stops", "transit-stop-labels" ],
		demand: [ "demand-clusters-glow", "demand-clusters", "demand-cluster-count", "demand-points" ],
		roads: [ "road-flow-glow", "road-flow-lines" ],
		service: [ "voronoi-analysis-fill", "voronoi-analysis-glow", "voronoi-analysis-line", "voronoi-site-glow", "voronoi-site-points" ],
		evidence: [ "ai-evidence-line-glow", "ai-evidence-lines", "ai-evidence-point-glow", "ai-evidence-points", "ai-evidence-labels" ],
		opportunity: [ "h3-opportunity-fill", "h3-opportunity-line", "location-candidate-glow", "location-candidates" ],
		districts: [ "district-fill", "district-line-glow", "district-line", "district-selected", "district-labels" ],
	}
	const applyFocusMode = () => {
		if( focusMode === "brand" ) {
			[ "poi", "metro", "transit", "demand", "roads", "service", "opportunity", "districts" ].forEach( group => setLayerVisibility( focusLayerGroups[ group ], false ) )
			setBrandLayerVisibility( "visible" )
		}
		else if( focusMode === "district" ) {
			[ "poi", "metro", "transit", "demand", "roads", "service", "opportunity" ].forEach( group => setLayerVisibility( focusLayerGroups[ group ], false ) )
			setLayerVisibility( focusLayerGroups.districts, true )
		}
		else if( focusMode === "analysis" ) {
			setLayerVisibility( [ "fast-food-heatmap" ], false )
			setLayerVisibility( [ "fast-food-point-glow", "fast-food-points" ], true )
			const poiFilter = [ "in", [ "get", "id" ], [ "literal", analysisFocusPoiIds ] ]
			;[ "fast-food-point-glow", "fast-food-points" ].forEach( layerId => {
				if( map?.getLayer( layerId ) ) {
					map.setFilter( layerId, poiFilter )
				}
			} )
			;[ "metro", "transit", "demand", "roads", "opportunity", "districts" ].forEach( group => setLayerVisibility( focusLayerGroups[ group ], false ) )
			setLayerVisibility( focusLayerGroups.service, true )
			setLayerVisibility( focusLayerGroups.evidence, true )
		}
		else if( focusMode === "find-results" ) {
			;[ "poi", "metro", "transit", "demand", "roads", "service", "districts" ].forEach( group => setLayerVisibility( focusLayerGroups[ group ], false ) )
			setLayerVisibility( [ "district-selected" ], true )
			setLayerVisibility( focusLayerGroups.opportunity, true )
		}
	}
	const enterFocusMode = ( mode, label ) => {
		if( !focusMode && map ) {
			focusCamera = { center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }
		}
		focusMode = mode
		closeLayerPanel()
		layersToggle.disabled = true
		focusReset.querySelector( "span" ).textContent = label
		focusReset.dataset.mode = mode
		focusReset.classList.remove( "is-hidden" )
		applyCustomLayerSettings()
	}
	const exitFocusMode = ( restoreCamera = true ) => {
		if( focusMode === "brand" ) {
			brandFilter.classList.add( "is-hidden" )
			setBrandLayerVisibility( "none" )
		}
		focusMode = null
		analysisFocusPoiIds = []
		;[ "fast-food-point-glow", "fast-food-points" ].forEach( layerId => {
			if( map?.getLayer( layerId ) ) {
				map.setFilter( layerId, null )
			}
		} )
		layersToggle.disabled = false
		focusReset.classList.add( "is-hidden" )
		delete focusReset.dataset.mode
		applyCustomLayerSettings()
		if( restoreCamera && focusCamera && map ) {
			map.easeTo( { ...focusCamera, duration: 700 } )
		}
		focusCamera = null
	}
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
		setLayerVisibility( [ "transit-stop-glow", "transit-stops", "transit-stop-labels" ], layerSettings.transitStops )
		setLayerVisibility( [ "demand-clusters-glow", "demand-clusters", "demand-cluster-count", "demand-points" ], layerSettings.demandGenerators )
		setLayerVisibility( [ "road-flow-glow", "road-flow-lines" ], layerSettings.roadFlow )
		setLayerVisibility( [ "voronoi-analysis-fill", "voronoi-analysis-glow", "voronoi-analysis-line", "voronoi-site-glow", "voronoi-site-points" ], layerSettings.serviceAreas )
		setLayerVisibility( [ "district-fill", "district-line-glow", "district-line", "district-selected" ], layerSettings.districts )
		setLayerVisibility( [ "district-labels" ], layerSettings.districts && opportunityFeatures.length === 0 )
		setLayerVisibility( [ "location-candidate-glow", "location-candidates" ], candidateFeatures.length > 0 )
		setLayerVisibility( [ "h3-opportunity-fill", "h3-opportunity-line" ], layerSettings.opportunityMap && opportunityFeatures.length > 0 )
		setLayerVisibility( focusLayerGroups.evidence, false )
		territoryLegend.classList.toggle( "is-hidden", !layerSettings.serviceAreas || territoryFeatures.length === 0 )
		districtLegend.classList.toggle( "is-hidden", !layerSettings.opportunityMap || opportunityFeatures.length === 0 || territoryFeatures.length > 0 )
		applyFocusMode()
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
	const renderAiAdvice = advice => {
		const advisor = get( ".ai-advisor" )
		advisor.dataset.tone = advice.tone
		get( "#ai-confidence" ).textContent = `${ advice.confidence }% ishonch`
		get( "#ai-verdict" ).textContent = advice.verdict
		get( "#ai-format" ).textContent = `Mos format: ${ advice.format } · AI ball ${ advice.score }/100`
		get( "#ai-strengths" ).replaceChildren( ...advice.strengths.map( strength => {
			const item = document.createElement( "li" )
			item.textContent = strength
			return item
		} ) )
		get( "#ai-risks" ).replaceChildren( ...advice.risks.map( risk => {
			const item = document.createElement( "li" )
			item.textContent = risk
			return item
		} ) )
		get( "#ai-action" ).textContent = advice.action
	}
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
		enterFocusMode( "district", "Barcha qatlamlarni qaytarish" )
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
	const transitCellSize = 0.01
	const buildTransitSpatialIndex = features => {
		transitSpatialIndex.clear()
		features.forEach( feature => {
			const coordinates = feature.geometry.coordinates
			const key = `${ Math.floor( coordinates[ 0 ] / transitCellSize ) }:${ Math.floor( coordinates[ 1 ] / transitCellSize ) }`
			const cell = transitSpatialIndex.get( key ) || []
			cell.push( feature )
			transitSpatialIndex.set( key, cell )
		} )
	}
	const getTransitContext = location => {
		const longitudeCell = Math.floor( location.lng / transitCellSize )
		const latitudeCell = Math.floor( location.lat / transitCellSize )
		const candidates = []
		for( let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++ ) {
			for( let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++ ) {
				candidates.push( ...( transitSpatialIndex.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) || [] ) )
			}
		}
		const nearby = candidates.map( feature => ( { feature, distance: distanceMeters( location, feature.geometry.coordinates ) } ) )
			.filter( item => item.distance <= 800 ).sort( ( first, second ) => first.distance - second.distance )
		const unique = new Map()
		nearby.forEach( item => {
			const name = normalizeSearch( item.feature.properties.name )
			const key = name && name !== "nomsiz avtobus bekati" ? name : item.feature.properties.id
			if( !unique.has( key ) ) {
				unique.set( key, item )
			}
		} )
		const stops = [ ...unique.values() ].sort( ( first, second ) => first.distance - second.distance )
		const nearest = stops[ 0 ] || null
		const distanceScore = nearest ? Math.max( 0, 100 - nearest.distance / 8 ) : 0
		const accessScore = Math.min( 100, Math.round( distanceScore + Math.max( 0, stops.length - 1 ) * 3 ) )

		return { nearby: stops, nearest, accessScore }
	}
	const demandCellSize = 0.01
	const getDemandCellKey = coordinates => `${ Math.floor( coordinates[ 0 ] / demandCellSize ) }:${ Math.floor( coordinates[ 1 ] / demandCellSize ) }`
	const buildDemandSpatialIndex = features => {
		demandSpatialIndex.clear()
		features.forEach( feature => {
			const key = getDemandCellKey( feature.geometry.coordinates )
			const cell = demandSpatialIndex.get( key ) || []
			cell.push( feature )
			demandSpatialIndex.set( key, cell )
		} )
	}
	const getDemandContext = ( location, localRadius = radius ) => {
		const longitudeCell = Math.floor( location.lng / demandCellSize )
		const latitudeCell = Math.floor( location.lat / demandCellSize )
		const candidates = []
		for( let longitudeOffset = -2; longitudeOffset <= 2; longitudeOffset++ ) {
			for( let latitudeOffset = -2; latitudeOffset <= 2; latitudeOffset++ ) {
				candidates.push( ...( demandSpatialIndex.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) || [] ) )
			}
		}
		const nearby = candidates.map( feature => {
			const distance = distanceMeters( location, feature.geometry.coordinates )
			const decay = distance < 1500 ? ( 1 - distance / 1500 ) ** 1.5 : 0
			return { feature, distance, contribution: Number( feature.properties.weight || 0 ) * decay }
		} ).filter( item => item.distance <= 1500 ).sort( ( first, second ) => first.distance - second.distance )
		const categoryTotals = new Map()
		nearby.forEach( item => categoryTotals.set( item.feature.properties.category, ( categoryTotals.get( item.feature.properties.category ) || 0 ) + item.contribution ) )
		const cappedTotal = [ ...categoryTotals.values() ].reduce( ( sum, value ) => sum + Math.min( 4, value ), 0 )
		const accessScore = Math.round( 100 * ( 1 - Math.exp( -cappedTotal / 16 ) ) )
		const dominantCategory = [ ...categoryTotals.entries() ].sort( ( first, second ) => second[ 1 ] - first[ 1 ] )[ 0 ]?.[ 0 ] || null
		const strongest = [ ...nearby ].sort( ( first, second ) => second.contribution - first.contribution )[ 0 ] || null

		return { nearby, withinRadius: nearby.filter( item => item.distance <= localRadius ), accessScore, dominantCategory, strongest }
	}
	const roadCellSize = 0.01
	const buildRoadSpatialIndex = features => {
		roadSpatialIndex.clear()
		features.forEach( feature => {
			const longitudes = feature.geometry.coordinates.map( coordinate => coordinate[ 0 ] )
			const latitudes = feature.geometry.coordinates.map( coordinate => coordinate[ 1 ] )
			const minimumLongitudeCell = Math.floor( Math.min( ...longitudes ) / roadCellSize )
			const maximumLongitudeCell = Math.floor( Math.max( ...longitudes ) / roadCellSize )
			const minimumLatitudeCell = Math.floor( Math.min( ...latitudes ) / roadCellSize )
			const maximumLatitudeCell = Math.floor( Math.max( ...latitudes ) / roadCellSize )
			for( let longitudeCell = minimumLongitudeCell; longitudeCell <= maximumLongitudeCell; longitudeCell++ ) {
				for( let latitudeCell = minimumLatitudeCell; latitudeCell <= maximumLatitudeCell; latitudeCell++ ) {
					const key = `${ longitudeCell }:${ latitudeCell }`
					const cell = roadSpatialIndex.get( key ) || []
					cell.push( feature )
					roadSpatialIndex.set( key, cell )
				}
			}
		} )
	}
	const getRoadContext = location => {
		const longitudeCell = Math.floor( location.lng / roadCellSize )
		const latitudeCell = Math.floor( location.lat / roadCellSize )
		const candidates = new Map()
		for( let longitudeOffset = -1; longitudeOffset <= 1; longitudeOffset++ ) {
			for( let latitudeOffset = -1; latitudeOffset <= 1; latitudeOffset++ ) {
				for( const feature of roadSpatialIndex.get( `${ longitudeCell + longitudeOffset }:${ latitudeCell + latitudeOffset }` ) || [] ) {
					candidates.set( feature.properties.id, feature )
				}
			}
		}
		const nearby = [ ...candidates.values() ].map( feature => {
			const distance = pointToLineDistance( point( [ location.lng, location.lat ] ), feature, { units: "meters" } )
			const proximity = distance < 1000 ? ( 1 - distance / 1000 ) ** 1.25 : 0
			return { feature, distance, signal: Number( feature.properties.flowScore || 0 ) * proximity }
		} ).filter( item => item.distance <= 1000 ).sort( ( first, second ) => first.distance - second.distance )
		const roadsByName = new Map()
		nearby.forEach( item => {
			const name = item.feature.properties.name
			const key = name === "Nomsiz yo‘l" ? item.feature.properties.id : normalizeSearch( name )
			if( !roadsByName.has( key ) || roadsByName.get( key ).signal < item.signal ) {
				roadsByName.set( key, item )
			}
		} )
		const strongest = [ ...roadsByName.values() ].sort( ( first, second ) => second.signal - first.signal )
		const accessScore = Math.min( 100, Math.round( ( strongest[ 0 ]?.signal || 0 ) + strongest.slice( 1, 3 ).reduce( ( sum, item ) => sum + item.signal * 0.12, 0 ) ) )

		return { nearby, nearest: nearby[ 0 ] || null, strongest: strongest[ 0 ] || null, accessScore }
	}
	const getComparisonSnapshot = location => {
		const competition = getSmartCompetition( location, distanceMeters, { radius } )
		const { competitors, pressureScore } = competition
		const metro = getMetroContext( location )
		const transit = getTransitContext( location )
		const demand = getDemandContext( location )
		const road = getRoadContext( location )
		const boundary = circle( [ location.lng, location.lat ], radius / 1000, { steps: 64, units: "kilometers" } )
		const nearbyPois = competitors.filter( item => item.distance <= radius ).map( item => point( item.feature.geometry.coordinates, { kind: "competitor" } ) )
		let territoryArea = area( boundary ) / 1000000
		if( nearbyPois.length ) {
			const cells = voronoi( featureCollection( [ point( [ location.lng, location.lat ], { kind: "candidate" } ), ...nearbyPois ] ), { bbox: bbox( boundary ) } )
			const candidateCell = cells.features.find( feature => feature.properties.kind === "candidate" )
			const clipped = candidateCell ? intersect( featureCollection( [ candidateCell, boundary ] ) ) : null
			if( clipped ) {
				territoryArea = area( clipped ) / 1000000
			}
		}
		const district = getDistrictAt( location )
		const opportunityScore = 100 - pressureScore
		const overallScore = Math.round( opportunityScore * 0.4 + demand.accessScore * 0.2 + metro.accessScore * 0.15 + transit.accessScore * 0.15 + road.accessScore * 0.1 )

		return { location, overallScore, pressureScore, competitorCount: competition.withinRadius.length, equivalentCompetitors: competition.equivalentCompetitors, nearestCompetitor: [ ...competitors ].sort( ( first, second ) => first.distance - second.distance )[ 0 ] || null, topThreat: competition.topThreat, territoryArea, metro, transit, demand, road, district }
	}
	const renderComparison = () => {
		const snapshots = { a: getComparisonSnapshot( comparePoints.a ), b: getComparisonSnapshot( comparePoints.b ) }
		const advice = {
			a: createLocationAdvice( { competition: snapshots.a.pressureScore, demand: snapshots.a.demand.accessScore, metro: snapshots.a.metro.accessScore, transit: snapshots.a.transit.accessScore, road: snapshots.a.road.accessScore, territoryRatio: 1, competitorCount: snapshots.a.competitorCount, topThreat: snapshots.a.topThreat ? cleanName( snapshots.a.topThreat.feature.properties.brandName || snapshots.a.topThreat.feature.properties.name ) : null } ),
			b: createLocationAdvice( { competition: snapshots.b.pressureScore, demand: snapshots.b.demand.accessScore, metro: snapshots.b.metro.accessScore, transit: snapshots.b.transit.accessScore, road: snapshots.b.road.accessScore, territoryRatio: 1, competitorCount: snapshots.b.competitorCount, topThreat: snapshots.b.topThreat ? cleanName( snapshots.b.topThreat.feature.properties.brandName || snapshots.b.topThreat.feature.properties.name ) : null } ),
		}
		const comparisonAdvice = createComparisonAdvice( advice.a, advice.b )
		const winner = comparisonAdvice.winner?.toLocaleLowerCase( "uz" ) || null
		get( "#comparison-a-coordinate" ).textContent = `${ comparePoints.a.lat.toFixed( 5 ) }, ${ comparePoints.a.lng.toFixed( 5 ) }`
		get( "#comparison-b-coordinate" ).textContent = `${ comparePoints.b.lat.toFixed( 5 ) }, ${ comparePoints.b.lng.toFixed( 5 ) }`
		get( "#comparison-a-score" ).textContent = `${ snapshots.a.overallScore }/100`
		get( "#comparison-b-score" ).textContent = `${ snapshots.b.overallScore }/100`
		get( "#comparison-radius" ).textContent = `${ radius / 1000 } km radius · bir xil scoring modeli`
		get( "#comparison-winner" ).textContent = comparisonAdvice.verdict
		get( "#comparison-summary" ).textContent = comparisonAdvice.summary
		get( "#comparison-ai-confidence" ).textContent = `${ comparisonAdvice.confidence }% ishonch`
		get( "#comparison-ai-risk" ).textContent = `Asosiy xavf: ${ comparisonAdvice.risk }.`
		const metrics = [
			{ label: "Raqobat bosimi", note: "Pastroq yaxshi", value: item => `${ item.pressureScore }/100`, raw: item => item.pressureScore, lower: true },
			{ label: "Raqobat ta’siri", note: "Brand, masofa va hudud kesishuvi", value: item => `${ item.equivalentCompetitors } ekv.`, raw: item => item.equivalentCompetitors, lower: true },
			{ label: "Talab oqimi", note: "Ta’lim, savdo, ofis va boshqa oqimlar", value: item => `${ item.demand.accessScore }/100`, raw: item => item.demand.accessScore },
			{ label: "Metro", note: item => item.metro.nearest ? formatDistance( item.metro.nearest.distance ) : "Bekat yo‘q", value: item => `${ item.metro.accessScore }/100`, raw: item => item.metro.accessScore },
			{ label: "Avtobus", note: item => `${ item.transit.nearby.length } ta bekat`, value: item => `${ item.transit.accessScore }/100`, raw: item => item.transit.accessScore },
			{ label: "Yo‘l oqimi", note: item => item.road.nearest?.feature.properties.name || "Asosiy yo‘l yo‘q", value: item => `${ item.road.accessScore }/100`, raw: item => item.road.accessScore },
			{ label: "Xizmat hududi", note: "Voronoi bo‘yicha taxmin", value: item => formatArea( item.territoryArea ), raw: item => item.territoryArea },
			{ label: "Tuman", note: item => item.district ? `${ formatNumber( item.district.properties.population ) } aholi` : "Chegaradan tashqari", value: item => item.district?.properties.name || "—", raw: () => null },
		]
		get( "#comparison-metrics" ).innerHTML = metrics.map( metric => {
			const firstRaw = metric.raw( snapshots.a )
			const secondRaw = metric.raw( snapshots.b )
			const better = firstRaw === null || firstRaw === secondRaw ? null : ( metric.lower ? firstRaw < secondRaw : firstRaw > secondRaw ) ? "a" : "b"
			const firstNote = typeof metric.note === "function" ? metric.note( snapshots.a ) : metric.note
			const secondNote = typeof metric.note === "function" ? metric.note( snapshots.b ) : metric.note
			return `<article><header><strong>${ metric.label }</strong><small>${ typeof metric.note === "string" ? metric.note : "" }</small></header><div class="${ better === "a" ? "is-better" : "" }"><span>A</span><b>${ metric.value( snapshots.a ) }</b><small>${ firstNote }</small></div><div class="${ better === "b" ? "is-better" : "" }"><span>B</span><b>${ metric.value( snapshots.b ) }</b><small>${ secondNote }</small></div></article>`
		} ).join( "" )
		comparison.classList.remove( "is-hidden" )
		map.fitBounds( [ [ Math.min( comparePoints.a.lng, comparePoints.b.lng ), Math.min( comparePoints.a.lat, comparePoints.b.lat ) ], [ Math.max( comparePoints.a.lng, comparePoints.b.lng ), Math.max( comparePoints.a.lat, comparePoints.b.lat ) ] ], { padding: { top: 80, right: window.innerWidth > 800 ? 610 : 40, bottom: 80, left: 80 }, maxZoom: 15, duration: 900 } )
		return { snapshots, winner, advice, comparisonAdvice }
	}
	const showMetroConnection = ( location, metro ) => {
		const features = metro.nearest ? [ {
			type: "Feature",
			geometry: { type: "LineString", coordinates: [ [ location.lng, location.lat ], metro.nearest.feature.geometry.coordinates ] },
			properties: { stationName: metro.nearest.feature.properties.name, distance: metro.nearest.distance },
		} ] : []
		map?.getSource( "metro-analysis-link" )?.setData( featureCollection( features ) )
	}
	const showAiEvidence = ( location, signals ) => {
		const origin = [ location.lng, location.lat ]
		const evidence = []
		const addEvidence = ( kind, label, target, distance ) => {
			if( !target ) {
				return
			}
			evidence.push( {
				type: "Feature",
				geometry: { type: "LineString", coordinates: [ origin, target ] },
				properties: { kind, label, distance, featureType: "connection" },
			}, point( target, { kind, label, distance, featureType: "evidence" } ) )
		}
		const threat = signals.topThreat
		addEvidence( "threat", `Xavf · ${ threat ? cleanName( threat.feature.properties.brandName || threat.feature.properties.name ) : "" }`, threat?.feature.geometry.coordinates, threat?.distance )
		const demand = signals.demand.strongest
		addEvidence( "demand", `Talab · ${ demand ? cleanName( demand.feature.properties.name ) : "" }`, demand?.feature.geometry.coordinates, demand?.distance )
		const metro = signals.metro.nearest
		addEvidence( "metro", `Metro · ${ metro ? cleanName( metro.feature.properties.name ) : "" }`, metro?.feature.geometry.coordinates, metro?.distance )
		const road = signals.road.nearest
		const roadTarget = road ? nearestPointOnLine( road.feature, point( origin ), { units: "meters" } ).geometry.coordinates : null
		addEvidence( "road", `Yo‘l · ${ road?.feature.properties.name || "" }`, roadTarget, road?.distance )
		map?.getSource( "ai-evidence" )?.setData( featureCollection( evidence ) )
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
		const competition = getSmartCompetition( selectedPoint, distanceMeters, { radius, excludeId: selectedPoiId } )
		const { competitors, withinRadius, pressureScore, pressureLevel, topThreat } = competition
		const { within500, within1000, within2000 } = competition.bands
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
		const nearest = [ ...competitors ].sort( ( first, second ) => first.distance - second.distance )[ 0 ]
		const territory = calculateTerritoryAnalysis()
		const metro = getMetroContext( selectedPoint )
		const transit = getTransitContext( selectedPoint )
		const demand = getDemandContext( selectedPoint )
		const road = getRoadContext( selectedPoint )
		showMetroConnection( selectedPoint, metro )
		showAiEvidence( selectedPoint, { topThreat, demand, metro, road } )
		const insight = pressureScore >= 70
			? "Bu hududda fast-food klasteri shakllangan. Talab signali bo‘lishi mumkin, ammo yangi biznes aniq format va kuchli differensiatsiya bilan kirishi kerak."
			: pressureScore >= 35
				? "Raqobat muvozanatli. Yaqin raqiblarning formati va yetakchi brend taklifidan farqlanish imkoniyati bor."
				: "Bevosita raqobat past. Bu imkoniyat bo‘lishi mumkin, lekin past zichlik talab yetarli degani emas — keyingi signallar bilan tekshirish kerak."

		get( "#competition-score" ).textContent = pressureScore
		get( "#competition-level" ).textContent = `${ pressureLevel } bosim`
		get( "#competition-summary" ).textContent = `${ radius / 1000 } km radiusda ${ withinRadius.length } ta nuqta · ${ competition.equivalentCompetitors } ta standart raqibga teng ta’sir.`
		get( "#competitor-count" ).textContent = withinRadius.length
		get( "#brand-count" ).textContent = brandCounts.size
		get( "#nearest-distance" ).textContent = nearest ? formatDistance( nearest.distance ) : "—"
		get( "#dominant-brand" ).textContent = topThreat ? cleanName( topThreat.feature.properties.brandName || topThreat.feature.properties.name ) : dominantBrand ? `${ dominantBrand.name } · ${ dominantBrand.count }` : "—"
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
		get( "#transit-access-score" ).textContent = transit.nearest ? `${ transit.accessScore }/100` : "—"
		get( "#nearest-transit-name" ).textContent = transit.nearest?.feature.properties.name || "Nomsiz avtobus bekati"
		get( "#nearest-transit-distance" ).textContent = transit.nearest ? formatDistance( transit.nearest.distance ) : "—"
		get( "#transit-count" ).textContent = transit.nearby.length
		get( "#transit-insight" ).textContent = !transit.nearest
			? "800 metr ichida avtobus bekati topilmadi. Lokatsiya jamoat transportidan keladigan oqimga kamroq tayanadi."
			: transit.accessScore >= 75
				? "Bekat juda yaqin va atrofda bir nechta yo‘nalish nuqtalari bor. Bu piyoda yo‘lovchilar oqimi uchun kuchli signal."
				: transit.accessScore >= 45
					? "Avtobusga chiqish qulayligi o‘rtacha. Bekatdan lokatsiyagacha xavfsiz piyoda yo‘lini joyida tekshirish kerak."
					: "Yaqin avtobus bekatlari kam yoki uzoq. Bu joy ko‘proq mahalliy aholi va avtomobil oqimiga tayanishi mumkin."
		get( "#demand-access-score" ).textContent = `${ demand.accessScore }/100`
		get( "#demand-nearby-count" ).textContent = demand.withinRadius.length
		get( "#demand-leading-category" ).textContent = demand.strongest?.feature.properties.categoryLabel || "Signal yo‘q"
		get( "#demand-strongest-place" ).textContent = demand.strongest ? `${ cleanName( demand.strongest.feature.properties.name ) } · ${ formatDistance( demand.strongest.distance ) }` : "—"
		get( "#demand-insight" ).textContent = demand.accessScore >= 75
			? "Atrofda turli auditoriyalarni olib keladigan obyektlar zich. Kunning bir necha vaqtida mijoz oqimi bo‘lishi mumkin."
			: demand.accessScore >= 45
				? "Talab generatorlari yetarli, ammo oqim ayrim auditoriya yoki vaqt oralig‘iga bog‘liq bo‘lishi mumkin."
				: "Yaqin atrofdagi talab generatorlari kam. Lokatsiya ko‘proq mahalliy aholi yoki avtomobil oqimiga tayanishi mumkin."
		get( "#road-access-score" ).textContent = `${ road.accessScore }/100`
		get( "#nearest-road-name" ).textContent = road.nearest?.feature.properties.name || "Asosiy yo‘l topilmadi"
		get( "#nearest-road-distance" ).textContent = road.nearest ? formatDistance( road.nearest.distance ) : "—"
		get( "#nearest-road-class" ).textContent = road.nearest?.feature.properties.roadClassLabel || "—"
		get( "#nearest-road-details" ).textContent = road.nearest ? `${ road.nearest.feature.properties.lanes ? `${ road.nearest.feature.properties.lanes } qator · ` : "" }${ road.nearest.feature.properties.maxspeed } km/soat` : "—"
		get( "#road-insight" ).textContent = road.accessScore >= 75
			? "Lokatsiya kuchli avtomobil oqimi proksisiga ega asosiy yo‘lga yaqin. Haqiqiy kirish va parking imkoniyatini joyida tekshirish kerak."
			: road.accessScore >= 45
				? "Asosiy yo‘lga chiqish imkoniyati o‘rtacha. Ko‘rinuvchanlik va burilish qulayligi natijani sezilarli o‘zgartirishi mumkin."
				: "Lokatsiya asosiy avtomobil yo‘llaridan uzoqroq. U ko‘proq piyoda yoki mahalliy mijoz oqimiga tayanadi."
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
		get( "#competition-insight" ).textContent = `${ insight } Eng kuchli xavf: ${ explainCompetitionThreat( topThreat, cleanName, formatDistance ) }`
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
		const advice = createLocationAdvice( { competition: pressureScore, demand: demand.accessScore, metro: metro.accessScore, transit: transit.accessScore, road: road.accessScore, territoryRatio: 1, competitorCount: withinRadius.length, topThreat: topThreat ? cleanName( topThreat.feature.properties.brandName || topThreat.feature.properties.name ) : null } )
		renderAiAdvice( advice )
		return { pressureScore, pressureLevel, competitorCount: withinRadius.length, equivalentCompetitors: competition.equivalentCompetitors, brandCount: brandCounts.size, nearest, topThreat, territory, metro, transit, demand, road, district, advice, poiIds: [ ...withinRadius.map( item => item.feature.properties.id ), ...( selectedPoiId ? [ selectedPoiId ] : [] ) ] }
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
			: `<span>JOY IMKONIYATI</span><strong>${ properties.opportunityScore }/100</strong><p>Mijoz ${ properties.customerScore } · talab ${ properties.demandScore } · metro ${ properties.metroScore } · avtobus ${ properties.transitScore } · yo‘l ${ properties.roadScore }.</p><small>${ properties.demandCount } ta talab generatori · ${ properties.transitCount } ta avtobus bekati${ properties.roadName ? ` · ${ properties.roadName } ${ formatDistance( properties.roadDistance ) }` : "" }.</small>`
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
		get( "#map-score-low" ).textContent = mode === "capture" ? "Past %" : "Band"
		get( "#map-score-high" ).textContent = mode === "capture" ? "Yuqori %" : "Imkoniyat"
	}
	const createCandidateAdvice = feature => createLocationAdvice( {
		competition: feature.properties.competitionScore,
		demand: feature.properties.demandScore,
		metro: feature.properties.metroScore,
		transit: feature.properties.transitScore,
		road: feature.properties.roadScore,
		territoryRatio: 1,
		competitorCount: feature.properties.nearby,
		topThreat: feature.properties.topThreat,
	} )
	const selectCandidateScenario = ( feature, focus = true ) => {
		activeCandidateId = feature.properties.id
		renderAiAdvice( createCandidateAdvice( feature ) )
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
		const transitText = feature.properties.transitName ? `${ feature.properties.transitName } · ${ formatDistance( feature.properties.transitDistance ) }` : "Avtobus signali yo‘q"
		content.innerHTML = `<span>#${ feature.properties.rank } · TAVSIYA ETILGAN JOY</span><strong>${ feature.properties.score }/100</strong><p>Smart raqobat ${ feature.properties.competitionScore } · mijoz ${ feature.properties.customerScore } · talab ${ feature.properties.demandScore } · metro ${ feature.properties.metroScore } · avtobus ${ feature.properties.transitScore } · yo‘l ${ feature.properties.roadScore }</p><small>${ feature.properties.competitionEquivalent } ta standart raqibga teng ta’sir${ feature.properties.topThreat ? ` · eng kuchli xavf: ${ feature.properties.topThreat }` : "" } · ${ feature.properties.roadName ? `${ feature.properties.roadName } ${ formatDistance( feature.properties.roadDistance ) }` : "asosiy yo‘l signali yo‘q" } · Metro: ${ metroText } · Avtobus: ${ transitText }</small>`
		const button = document.createElement( "button" )
		button.type = "button"
		button.textContent = "Bu nuqtani chuqur tahlil qilish"
		content.append( button )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 18, maxWidth: "330px", className: "candidate-popup" } )
			.setLngLat( coordinates ).setDOMContent( content ).addTo( map )
		button.addEventListener( "click", () => {
			activePopup.remove()
			startWorkflow( "analyze", { preserveFocus: true } )
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
			const transit = getTransitContext( center )
			const demand = getDemandContext( center )
			const road = getRoadContext( center )
			const competition = getSmartCompetition( center, distanceMeters, { radius } )
			return { origin, coordinates, servedPopulation, marketShare: servedPopulation / Number( district.properties.population ) * 100, nearby: competition.withinRadius.length, nearest: distances[ 0 ] ?? 5000, metro, transit, demand, road, competition }
		} )
		const servedValues = scored.map( item => item.servedPopulation )
		const minimumServed = Math.min( ...servedValues )
		const servedRange = Math.max( 1, Math.max( ...servedValues ) - minimumServed )
		scored.forEach( item => {
			const customerScore = ( item.servedPopulation - minimumServed ) / servedRange * 100
			const combinedScore = customerScore * 0.3 + ( 100 - item.competition.pressureScore ) * 0.2 + item.demand.accessScore * 0.15 + item.metro.accessScore * 0.125 + item.transit.accessScore * 0.125 + item.road.accessScore * 0.1
			item.score = Math.round( 35 + combinedScore / 100 * 63 )
			item.customerScore = Math.round( customerScore )
			item.origin.properties.opportunityScore = item.score
			item.origin.properties.displayScore = item.score
			item.origin.properties.customerScore = item.customerScore
			item.origin.properties.demandScore = item.demand.accessScore
			item.origin.properties.demandCount = item.demand.withinRadius.length
			item.origin.properties.demandCategory = item.demand.strongest?.feature.properties.categoryLabel || null
			item.origin.properties.roadScore = item.road.accessScore
			item.origin.properties.roadDistance = item.road.nearest?.distance ?? null
			item.origin.properties.roadName = item.road.nearest?.feature.properties.name || null
			item.origin.properties.metroScore = item.metro.accessScore
			item.origin.properties.metroDistance = item.metro.nearest?.distance ?? null
			item.origin.properties.metroName = item.metro.nearest?.feature.properties.name || null
			item.origin.properties.transitScore = item.transit.accessScore
			item.origin.properties.transitCount = item.transit.nearby.length
			item.origin.properties.transitDistance = item.transit.nearest?.distance ?? null
			item.origin.properties.transitName = item.transit.nearest?.feature.properties.name || null
			item.origin.properties.competitionScore = item.competition.pressureScore
			item.origin.properties.competitionEquivalent = item.competition.equivalentCompetitors
			item.origin.properties.topThreat = item.competition.topThreat ? cleanName( item.competition.topThreat.feature.properties.brandName || item.competition.topThreat.feature.properties.name ) : null
		} )
		scored.sort( ( first, second ) => second.score - first.score )
		candidateFeatures = []
		for( const item of scored ) {
			const feature = point( item.coordinates, { id: `candidate-${ item.origin.properties.id }`, score: item.score, customerScore: item.customerScore, demandScore: item.demand.accessScore, demandCount: item.demand.withinRadius.length, demandCategory: item.demand.strongest?.feature.properties.categoryLabel || null, roadScore: item.road.accessScore, roadDistance: item.road.nearest?.distance ?? null, roadName: item.road.nearest?.feature.properties.name || null, nearby: item.nearby, nearest: item.nearest, servedPopulation: item.servedPopulation, marketShare: item.marketShare, district: district.properties.name, metroScore: item.metro.accessScore, metroDistance: item.metro.nearest?.distance ?? null, metroName: item.metro.nearest?.feature.properties.name || null, transitScore: item.transit.accessScore, transitCount: item.transit.nearby.length, transitDistance: item.transit.nearest?.distance ?? null, transitName: item.transit.nearest?.feature.properties.name || null, competitionScore: item.competition.pressureScore, competitionEquivalent: item.competition.equivalentCompetitors, topThreat: item.origin.properties.topThreat } )
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
		get( "#find-district-summary" ).textContent = `Tuman ${ opportunityFeatures.length } ta kichik hududga bo‘lindi. Mijoz 30%, smart raqobat 20%, talab 15%, metro 12.5%, avtobus 12.5% va yo‘l 10% vazn bilan hisoblandi.`
		get( "#map-score-legend" ).textContent = "Joy imkoniyati"
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
			button.innerHTML = `<span>${ feature.properties.rank }</span><div><strong>${ feature.properties.score } ball · ${ feature.properties.marketShare.toFixed( 1 ) }% bozor ulushi</strong><small>Raqobat ${ feature.properties.competitionScore}/100 · talab ${ feature.properties.demandScore}/100 · yo‘l ${ feature.properties.roadScore}/100 · ${ metroLabel }</small></div><b>Ko‘rish</b>`
			button.addEventListener( "click", () => {
				showCandidatePopup( feature )
			} )
			list.append( button )
		} )
		map.fitBounds( bbox( district ), { padding: { top: 70, right: window.innerWidth > 800 ? 560 : 35, bottom: 70, left: 70 }, duration: 900 } )
		const topCandidate = candidateFeatures[ 0 ]
		const advice = topCandidate ? createCandidateAdvice( topCandidate ) : createLocationAdvice( {} )
		renderAiAdvice( advice )
		return { district, candidates: candidateFeatures, advice }
	}

	const clearBrandMode = () => {
		brandFilter.classList.add( "is-hidden" )
		if( focusMode === "brand" ) {
			exitFocusMode( false )
			return
		}
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
		enterFocusMode( "brand", "Barcha qatlamlarni qaytarish" )
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
		if( focusMode ) {
			exitFocusMode( false )
		}
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
	const showTransitPopup = ( feature, coordinates ) => {
		activePopup?.remove()
		const properties = feature.properties
		const content = document.createElement( "div" )
		content.className = "transit-popup__content"
		const types = Array.isArray( properties.types ) ? properties.types.join( ", " ) : properties.types
		const refs = Array.isArray( properties.refs ) ? properties.refs.join( ", " ) : properties.refs
		content.innerHTML = `<span>AVTOBUS BEKATI</span><strong>${ properties.name || "Nomsiz bekat" }</strong><p>${ types || "platform" }${ refs ? ` · Yo‘nalish/ref: ${ refs }` : "" }</p><small>${ properties.recordCount > 1 ? `${ properties.recordCount } ta yaqin yozuv birlashtirilgan. ` : "" }Manba: OpenStreetMap contributors</small>`
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 15, maxWidth: "320px", className: "transit-popup" } )
			.setLngLat( coordinates ).setDOMContent( content ).addTo( map )
	}
	const loadTransitLayer = async() => {
		try {
			const response = await fetch( "/data/transit-stops.geojson" )
			if( !response.ok ) {
				throw new Error( `Transit stop data request failed: ${ response.status }` )
			}
			const data = await response.json()
			transitFeatures = data.features
			buildTransitSpatialIndex( transitFeatures )
			map.getSource( "transit-stops" ).setData( data )
			applyCustomLayerSettings()
		}
		catch( error ) {
			console.error( error )
		}
	}
	const loadDemandLayer = async() => {
		try {
			const response = await fetch( "/data/demand-generators.geojson" )
			if( !response.ok ) {
				throw new Error( `Demand generator data request failed: ${ response.status }` )
			}
			const data = await response.json()
			demandFeatures = data.features
			buildDemandSpatialIndex( demandFeatures )
			map.getSource( "demand-generators" ).setData( data )
			applyCustomLayerSettings()
		}
		catch( error ) {
			console.error( error )
		}
	}
	const showRoadPopup = ( feature, lngLat ) => {
		activePopup?.remove()
		const properties = feature.properties
		const content = document.createElement( "div" )
		const eyebrow = document.createElement( "span" )
		const name = document.createElement( "strong" )
		const description = document.createElement( "p" )
		const note = document.createElement( "small" )
		content.className = "road-popup__content"
		eyebrow.textContent = "YO‘L OQIMI PROKSI"
		name.textContent = properties.name
		description.textContent = `${ properties.roadClassLabel } · ${ properties.lanes ? `${ properties.lanes } qator · ` : "" }${ properties.maxspeed } km/soat`
		note.textContent = `${ properties.flowScore }/100 — yo‘l turi, qatorlar va tezlik asosidagi taxminiy signal. Bu real trafik o‘lchovi emas.`
		content.append( eyebrow, name, description, note )
		activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 10, maxWidth: "320px", className: "road-popup" } )
			.setLngLat( lngLat ).setDOMContent( content ).addTo( map )
	}
	const loadRoadLayer = async() => {
		try {
			const response = await fetch( "/data/roads-scoring.geojson" )
			if( !response.ok ) {
				throw new Error( `Road data request failed: ${ response.status }` )
			}
			const data = await response.json()
			roadFeatures = data.features
			buildRoadSpatialIndex( roadFeatures )
			map.getSource( "road-flow" ).setData( data )
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
			getSmartCompetition = createCompetitionModel( poiFeatures )
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
		map.addSource( "transit-stops", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "demand-generators", { type: "geojson", data: featureCollection( [] ), promoteId: "id", cluster: true, clusterMaxZoom: 14, clusterRadius: 42 } )
		map.addSource( "road-flow", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "h3-opportunity", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "location-candidates", { type: "geojson", data: featureCollection( [] ), promoteId: "id" } )
		map.addSource( "selection-radius", { type: "geojson", data: { type: "FeatureCollection", features: [] } } )
		map.addSource( "comparison-radius", { type: "geojson", data: featureCollection( [] ) } )
		map.addSource( "voronoi-analysis", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addSource( "voronoi-sites", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" } )
		map.addSource( "ai-evidence", { type: "geojson", data: featureCollection( [] ) } )
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
		map.addLayer( { id: "comparison-radius-fill", type: "fill", source: "comparison-radius", paint: { "fill-color": [ "match", [ "get", "slot" ], "a", "#2388ff", "#aa6cff" ], "fill-opacity": 0.08, "fill-emissive-strength": 0.45 } } )
		map.addLayer( { id: "comparison-radius-line", type: "line", source: "comparison-radius", paint: { "line-color": [ "match", [ "get", "slot" ], "a", "#71c5ff", "#d8a5ff" ], "line-width": 3, "line-dasharray": [ 2, 1.4 ], "line-opacity": 0.95, "line-emissive-strength": 2.1 } } )
		map.addLayer( { id: "ai-evidence-line-glow", type: "line", source: "ai-evidence", filter: [ "==", [ "geometry-type" ], "LineString" ], layout: { visibility: "none", "line-cap": "round" }, paint: { "line-color": [ "match", [ "get", "kind" ], "threat", "#ff5378", "demand", "#a67cff", "metro", "#49dfff", "road", "#ffbd59", "#ffffff" ], "line-width": 11, "line-blur": 8, "line-opacity": 0.55, "line-emissive-strength": 3 } } )
		map.addLayer( { id: "ai-evidence-lines", type: "line", source: "ai-evidence", filter: [ "==", [ "geometry-type" ], "LineString" ], layout: { visibility: "none", "line-cap": "round" }, paint: { "line-color": [ "match", [ "get", "kind" ], "threat", "#ff7895", "demand", "#c0a4ff", "metro", "#baf7ff", "road", "#ffd58b", "#ffffff" ], "line-width": 2.5, "line-dasharray": [ 2, 1.4 ], "line-opacity": 1, "line-emissive-strength": 2.5 } } )
		map.addLayer( { id: "ai-evidence-point-glow", type: "circle", source: "ai-evidence", filter: [ "==", [ "geometry-type" ], "Point" ], layout: { visibility: "none" }, paint: { "circle-color": [ "match", [ "get", "kind" ], "threat", "#ff5378", "demand", "#9d78ff", "metro", "#42ddff", "road", "#ffb84d", "#ffffff" ], "circle-radius": 20, "circle-blur": 0.72, "circle-opacity": 0.8, "circle-emissive-strength": 3 } } )
		map.addLayer( { id: "ai-evidence-points", type: "circle", source: "ai-evidence", filter: [ "==", [ "geometry-type" ], "Point" ], layout: { visibility: "none" }, paint: { "circle-color": "#07121f", "circle-radius": 8, "circle-stroke-color": [ "match", [ "get", "kind" ], "threat", "#ff7895", "demand", "#c0a4ff", "metro", "#baf7ff", "road", "#ffd58b", "#ffffff" ], "circle-stroke-width": 3, "circle-emissive-strength": 2.5 } } )
		map.addLayer( { id: "ai-evidence-labels", type: "symbol", source: "ai-evidence", filter: [ "==", [ "geometry-type" ], "Point" ], layout: { visibility: "none", "text-field": [ "concat", [ "get", "label" ], "\n", [ "to-string", [ "round", [ "get", "distance" ] ] ], " m" ], "text-size": 11, "text-offset": [ 0, 1.45 ], "text-anchor": "top", "text-allow-overlap": false, "text-padding": 12 }, paint: { "text-color": "#f3f8ff", "text-halo-color": "rgba(3, 10, 19, .96)", "text-halo-width": 2.5, "text-halo-blur": 1, "text-emissive-strength": 2 } } )
		map.addLayer( { id: "location-candidate-glow", type: "circle", source: "location-candidates", paint: { "circle-color": "#36c7ff", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 18, 15, 28 ], "circle-blur": 0.72, "circle-opacity": 0.72, "circle-emissive-strength": 3 } } )
		map.addLayer( { id: "location-candidates", type: "circle", source: "location-candidates", paint: { "circle-color": [ "interpolate", [ "linear" ], [ "get", "score" ], 50, "#4f85bd", 75, "#42c3ff", 95, "#e8fbff" ], "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 7, 15, 11 ], "circle-stroke-color": "#071525", "circle-stroke-width": 3, "circle-emissive-strength": 2.5 } } )
		map.addLayer( { id: "road-flow-glow", type: "line", source: "road-flow", layout: { "line-sort-key": [ "get", "flowScore" ] }, paint: { "line-color": [ "interpolate", [ "linear" ], [ "get", "flowScore" ], 45, "#5478b9", 70, "#268cff", 90, "#54ddff", 100, "#d7f9ff" ], "line-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 4, 14, 9 ], "line-blur": 5, "line-opacity": 0.5, "line-emissive-strength": 2.8 } } )
		map.addLayer( { id: "road-flow-lines", type: "line", source: "road-flow", layout: { "line-cap": "round", "line-join": "round", "line-sort-key": [ "get", "flowScore" ] }, paint: { "line-color": [ "interpolate", [ "linear" ], [ "get", "flowScore" ], 45, "#6688bc", 70, "#4ea5ff", 90, "#8beaff", 100, "#efffff" ], "line-width": [ "interpolate", [ "linear" ], [ "zoom" ], 9, 1, 14, 3.2 ], "line-opacity": 0.94, "line-emissive-strength": 2.1 } } )
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
		map.addLayer( { id: "transit-stop-glow", type: "circle", source: "transit-stops", minzoom: 10, layout: { visibility: "none" }, paint: { "circle-color": "#43f0b1", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 7, 15, 13 ], "circle-blur": 0.74, "circle-opacity": 0.68, "circle-emissive-strength": 2.8 } } )
		map.addLayer( { id: "transit-stops", type: "circle", source: "transit-stops", minzoom: 10, layout: { visibility: "none" }, paint: { "circle-color": "#07251f", "circle-radius": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 3, 15, 5.5 ], "circle-stroke-color": "#83ffd2", "circle-stroke-width": [ "interpolate", [ "linear" ], [ "zoom" ], 10, 1.5, 15, 2.5 ], "circle-emissive-strength": 2.3 } } )
		map.addLayer( { id: "transit-stop-labels", type: "symbol", source: "transit-stops", minzoom: 14, layout: { visibility: "none", "text-field": [ "coalesce", [ "get", "name" ], "Avtobus bekati" ], "text-size": 10, "text-offset": [ 0, 1 ], "text-anchor": "top", "text-allow-overlap": false, "text-padding": 10 }, paint: { "text-color": "#dffff3", "text-halo-color": "rgba(3, 18, 17, .96)", "text-halo-width": 2, "text-halo-blur": 1, "text-emissive-strength": 1.6 } } )
		map.on( "click", event => {
			if( isSelecting ) {
				if( activeWorkflow === "find" ) {
					const district = getDistrictAt( event.lngLat )
					if( district ) {
						selectDistrict( district )
					}
				}
				else if( activeWorkflow === "compare" ) {
					selectCompareLocation( event.lngLat )
					hint.innerHTML = `<span><i data-lucide="locate-fixed"></i></span> ${ comparePoints.a && !comparePoints.b ? "B lokatsiyani belgilang" : "A yoki B kartasini tanlab nuqtani o‘zgartiring" }`
					createIcons( { icons: { LocateFixed }, attrs: { "stroke-width": 1.8 } } )
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
		map.on( "click", "transit-stops", event => showTransitPopup( event.features[ 0 ], event.features[ 0 ].geometry.coordinates ) )
		map.on( "click", "demand-points", event => showDemandPopup( event.features[ 0 ], event.features[ 0 ].geometry.coordinates ) )
		map.on( "click", "ai-evidence-points", event => {
			const evidence = event.features[ 0 ]
			const descriptions = {
				threat: "Brand kuchi, masofa va xizmat hududi kesishuvi sabab eng katta raqobat ta’siri shu nuqtadan kelmoqda.",
				demand: "Bu obyekt yaqin atrofdagi eng kuchli mijoz oqimi signalidir.",
				metro: "Eng yaqin metro bekati lokatsiyaning piyoda oqimi imkoniyatini ko‘rsatadi.",
				road: "Asosiy yo‘lga eng yaqin nuqta avtomobil oqimi va ko‘rinuvchanlik uchun proksi sifatida ishlatiladi.",
			}
			const content = document.createElement( "div" )
			content.className = "h3-popup__content"
			content.innerHTML = `<span>AI DALILI</span><strong>${ evidence.properties.label }</strong><p>${ formatDistance( evidence.properties.distance ) } masofada</p><small>${ descriptions[ evidence.properties.kind ] }</small>`
			activePopup?.remove()
			activePopup = new window.mapboxgl.Popup( { closeButton: true, closeOnClick: true, offset: 16, className: "h3-popup" } ).setLngLat( evidence.geometry.coordinates ).setDOMContent( content ).addTo( map )
		} )
		map.on( "mouseenter", "ai-evidence-points", () => map.getCanvas().style.cursor = "pointer" )
		map.on( "mouseleave", "ai-evidence-points", () => map.getCanvas().style.cursor = "default" )
		map.on( "click", "demand-clusters", event => map.easeTo( { center: event.features[ 0 ].geometry.coordinates, zoom: Math.min( 16, map.getZoom() + 2 ), duration: 500 } ) )
		map.on( "click", "road-flow-lines", event => showRoadPopup( event.features[ 0 ], event.lngLat ) )
		map.on( "click", "h3-opportunity-fill", event => {
			if( map.queryRenderedFeatures( event.point, { layers: [ "location-candidates" ] } ).length === 0 ) {
				showH3Popup( event.features[ 0 ], event.lngLat )
			}
		} )
		;[ "district-fill", "h3-opportunity-fill", "location-candidates", "metro-stations", "metro-entrances", "transit-stops", "demand-points", "demand-clusters", "road-flow-lines" ].forEach( layerId => {
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
		metroLayerPromise = loadMetroLayer()
		transitLayerPromise = loadTransitLayer()
		demandLayerPromise = loadDemandLayer()
		roadLayerPromise = loadRoadLayer()
		poiLayerPromise = loadPoiLayer()
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
		if( [ "analyze", "find", "compare" ].includes( button.dataset.view ) ) {
			startWorkflow( button.dataset.view )
		}
		else {
			showPage( button.dataset.view )
		}
	} ) )
	get( ".close-button" ).addEventListener( "click", showMap )
	get( ".close-report" ).addEventListener( "click", showMap )
	get( ".close-page" ).addEventListener( "click", showMap )
	get( ".close-comparison" ).addEventListener( "click", showMap )
	focusReset.addEventListener( "click", () => exitFocusMode( true ) )
	get( "#save-analysis-report" ).addEventListener( "click", event => savePendingReport( event.currentTarget ) )
	get( "#save-comparison-report" ).addEventListener( "click", event => savePendingReport( event.currentTarget ) )
	root.querySelectorAll( "[data-compare-slot]" ).forEach( button => button.addEventListener( "click", () => {
		activeCompareSlot = button.dataset.compareSlot
		root.querySelectorAll( "[data-compare-slot]" ).forEach( item => item.classList.toggle( "is-active", item === button ) )
		get( "#compare-picker-help" ).textContent = `${ activeCompareSlot.toUpperCase() } lokatsiya uchun xaritadan yangi nuqta tanlang.`
	} ) )
	brandFilter.querySelector( "button" ).addEventListener( "click", clearBrandMode )
	territoryLegendToggle.addEventListener( "click", () => {
		const collapsed = territoryLegend.classList.toggle( "is-collapsed" )
		territoryLegendToggle.setAttribute( "aria-expanded", String( !collapsed ) )
		territoryLegendToggle.setAttribute( "aria-label", collapsed ? "Xizmat hududi izohini ochish" : "Xizmat hududi izohini yig‘ish" )
		localStorage.setItem( "ummon-territory-legend-collapsed", String( collapsed ) )
	} )
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

	action.addEventListener( "click", async() => {
		isSelecting = false
		await Promise.all( [ poiLayerPromise, metroLayerPromise, transitLayerPromise, demandLayerPromise, roadLayerPromise ].filter( Boolean ) )
		closeLayerPanel()
		hidePanels()
		syncLayerControls()
		if( activeWorkflow === "compare" ) {
			territoryLegend.classList.add( "is-hidden" )
			const result = renderComparison()
			const winnerLabel = result.winner ? `${ result.winner.toUpperCase() } lokatsiya` : "Teng natija"
			setPendingReport( {
				type: "compare", typeLabel: "Taqqoslash", title: `${ winnerLabel } tavsiya etildi`,
				summary: get( "#comparison-summary" ).textContent,
				location: `A: ${ comparePoints.a.lat.toFixed( 5 )}, ${ comparePoints.a.lng.toFixed( 5 ) } · B: ${ comparePoints.b.lat.toFixed( 5 )}, ${ comparePoints.b.lng.toFixed( 5 ) }`,
				radius,
				metrics: [ { label: "A AI ball", value: `${ result.advice.a.score }/100` }, { label: "B AI ball", value: `${ result.advice.b.score }/100` }, { label: "AI ishonchi", value: `${ result.comparisonAdvice.confidence }%` } ],
			} )
			return
		}
		report.classList.remove( "is-hidden" )
		report.classList.toggle( "is-find-report", activeWorkflow === "find" )
		if( activeWorkflow === "find" ) {
			if( focusMode === "district" ) {
				exitFocusMode( false )
			}
			territoryLegend.classList.add( "is-hidden" )
			const result = findDistrictLocations()
			enterFocusMode( "find-results", "Barcha qatlamlarni qaytarish" )
			const district = districtFeatures.find( feature => feature.properties.id === selectedDistrictId )
			get( "#report-title" ).textContent = "Tavsiya etilgan lokatsiyalar"
			get( "#report-location" ).textContent = `${ district.properties.name } · ${ radius / 1000 } km lokal radius`
			const topCandidate = result.candidates[ 0 ]
			setPendingReport( {
				type: "find", typeLabel: "Joy topish", title: `${ district.properties.name } uchun ${ result.candidates.length } ta joy`,
				summary: topCandidate ? `${ result.advice.verdict }. ${ result.advice.action }` : "Mos lokatsiya topilmadi.",
				location: `${ district.properties.name } tumani`, radius,
				metrics: [ { label: "AI ball", value: topCandidate ? `${ result.advice.score }/100` : "—" }, { label: "Mos format", value: topCandidate ? result.advice.format : "—" }, { label: "Tavsiyalar", value: `${ result.candidates.length } ta` } ],
			} )
		}
		else {
			const result = analyzeCompetition()
			analysisFocusPoiIds = result.poiIds
			enterFocusMode( "analysis", "Barcha qatlamlarni qaytarish" )
			syncLayerControls()
			applyCustomLayerSettings()
			territoryLegend.classList.remove( "is-hidden" )
			get( "#report-title" ).textContent = "Raqobat tahlili"
			get( "#report-location" ).textContent = `${ selectedPoint.lat.toFixed( 5 ) }, ${ selectedPoint.lng.toFixed( 5 ) } · ${ radius / 1000 } km`
			setPendingReport( {
				type: "analyze", typeLabel: "Lokatsiya tahlili", title: result.district ? `${ result.district.properties.name }dagi lokatsiya` : "Tanlangan lokatsiya",
				summary: `${ result.advice.verdict }. ${ result.advice.action }`,
				location: `${ selectedPoint.lat.toFixed( 5 ) }, ${ selectedPoint.lng.toFixed( 5 ) }`, radius,
				metrics: [ { label: "AI ball", value: `${ result.advice.score }/100` }, { label: "Mos format", value: result.advice.format }, { label: "AI ishonchi", value: `${ result.advice.confidence }%` } ],
			} )
		}
	} )
}
