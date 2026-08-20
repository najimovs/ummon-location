const uzToEn = new Map( Object.entries( {
	"Tahlil": "Analyze", "Joy topish": "Find locations", "Hisobotlar": "Reports", "Taqqoslash": "Compare", "Qatlamlar": "Layers",
	"Asosiy vositalar": "Main tools", "Fast food yoki manzilni qidiring": "Search fast food or an address", "Fast food qidirish": "Search fast food",
	"XARITA SOZLAMALARI": "MAP SETTINGS", "Xarita qatlamlari": "Map layers", "Qatlamlarni yopish": "Close layers", "Ummon data": "Ummon data", "Asosiy xarita": "Base map",
	"Fast-food nuqtalari": "Fast-food locations", "Restoran va tarmoq manzillari": "Restaurants and chain locations", "Zichlik heatmap’i": "Density heatmap", "Fast-food klasterlari": "Fast-food clusters",
	"Metro bekatlari": "Metro stations", "Bekatlar va kirish nuqtalari": "Stations and entrances", "Avtobus bekatlari": "Bus stops", "1 403 ta tozalangan transport nuqtasi": "1,403 cleaned transit points",
	"Talab generatorlari": "Demand generators", "Ta’lim, ofis, savdo va boshqa oqimlar": "Education, offices, retail and other flows", "Yo‘l oqimi": "Road flow", "Asosiy avtomobil yo‘llari va kuchi": "Main roads and flow strength",
	"Xizmat hududlari": "Service areas", "Joy tahlilidan keyin ochiladi": "Available after location analysis", "Tumanlar": "Districts", "Chegara va tuman nomlari": "Boundaries and district names",
	"Imkoniyat xaritasi": "Opportunity map", "“Joy topish” natijasidan keyin ochiladi": "Available after location search", "Joy nomlari": "Place labels", "Tuman va mahallalar": "Districts and neighborhoods",
	"Yo‘l nomlari": "Road labels", "Ko‘cha va magistrallar": "Streets and highways", "Standart obyekt belgilari": "Standard place labels", "Transport": "Transit", "Metro va bekatlar": "Metro and stops",
	"3D obyektlar": "3D objects", "Bino va konstruksiyalar": "Buildings and structures", "Tanlovlar ushbu qurilmada saqlanadi": "Preferences are saved on this device",
	"YANGI TAHLIL": "NEW ANALYSIS", "Lokatsiyani belgilang": "Select a location", "Xaritadan fast food ochmoqchi bo‘lgan aniq nuqtani tanlang.": "Choose the exact map point where you want to open a fast-food business.",
	"NUQTA": "POINT", "Xaritani bosing": "Click the map", "BIRINCHI JOY": "FIRST LOCATION", "IKKINCHI JOY": "SECOND LOCATION", "Xaritadan tanlang": "Select on map",
	"Avval A lokatsiyani xaritadan belgilang.": "First select location A on the map.", "Tumanni tanlang": "Select a district", "Tuman tanlanmagan": "No district selected", "Tahlil radiusi": "Analysis radius", "Tahlilni boshlash": "Start analysis",
	"REAL GEO ANALYTICS": "REAL GEO ANALYTICS", "Raqobat tahlili": "Competition analysis", "Tanlangan lokatsiya": "Selected location", "Tahlil kutilmoqda": "Waiting for analysis", "Mos biznes formati aniqlanadi": "The best business format will be identified",
	"KUCHLI TOMONLAR": "STRENGTHS", "XAVFLAR": "RISKS", "Geo signallar hisoblanmoqda": "Calculating geo signals", "Ma’lumot kutilmoqda": "Waiting for data", "KEYINGI QADAM": "NEXT STEP", "Tahlildan keyin amaliy tavsiya chiqadi.": "An actionable recommendation will appear after analysis.",
	"AI BALL TARKIBI": "AI SCORE BREAKDOWN", "Nima natijani o‘zgartirdi?": "What changed the result?", "50 bazaviy balldan boshlab har bir geo-signal natijani oshiradi yoki pasaytiradi. Qatorni bosib xaritadagi dalilni ko‘ring.": "Starting from a neutral score of 50, each geo signal raises or lowers the result. Select a row to view its map evidence.",
	"Bazaviy ball": "Base score", "Yakuniy ball": "Final score", "TUMAN KONTEKSTI": "DISTRICT CONTEXT", "Aniqlanmoqda…": "Detecting…", "Aholi": "Population", "Fast-food": "Fast food", "10 000 aholiga": "Per 10,000 people",
	"RAQOBAT BOSIMI": "COMPETITION PRESSURE", "Hisoblanmoqda": "Calculating", "Radius ichidagi fast-food nuqtalari asosida.": "Based on fast-food locations within the radius.", "Raqobatchilar": "Competitors", "Tarmoq brendlari": "Chain brands", "Eng yaqin raqib": "Nearest competitor", "Yetakchi brend": "Leading brand",
	"METRO QULAYLIGI": "METRO ACCESS", "Eng yaqin bekat": "Nearest station", "Radius ichida": "Within radius", "metro bekati": "metro stations", "Metro ma’lumoti yuklanmoqda…": "Loading metro data…",
	"AVTOBUS QULAYLIGI": "BUS ACCESS", "800 metr ichida": "Within 800 meters", "noyob bekat": "unique stops", "Avtobus bekatlari hisoblanmoqda…": "Calculating bus stops…",
	"TALAB OQIMI POTENSIALI": "DEMAND FLOW POTENTIAL", "talab generatori": "demand generators", "Kuchli auditoriya": "Strongest audience", "Signal yo‘q": "No signal", "Talab generatorlari hisoblanmoqda…": "Calculating demand generators…",
	"YO‘L OQIMI POTENSIALI": "ROAD FLOW POTENTIAL", "Eng yaqin asosiy yo‘l": "Nearest main road", "Yo‘l klassi": "Road class", "Yo‘l tarmog‘i hisoblanmoqda…": "Calculating road network…",
	"MIJOZ TANLOVI SIMULYATSIYASI": "CUSTOMER CHOICE SIMULATION", "Simulyatsiyada nima sodir bo‘ladi?": "What happens in the simulation?", "Hudud bo‘linadi": "The area is divided", "Tuman kichik olti burchakli qismlarga ajratiladi.": "The district is divided into small hexagonal cells.",
	"Har bir joy sinab ko‘riladi": "Every location is tested", "Shu yerda yangi fast-food ochilsa, odamlar uni tanlash ehtimoli hisoblanadi.": "The model estimates the likelihood that people would choose a new fast-food location here.",
	"Eng kuchli joylar saralanadi": "The strongest locations are ranked", "Mijoz salohiyati, talab generatorlari, metro, avtobus va asosiy yo‘llar birgalikda solishtiriladi.": "Customer potential, demand generators, metro, buses and main roads are evaluated together.",
	"Eng yaxshi joylar": "Best locations", "Tanlangan joy ta’siri": "Selected location impact", "Xaritadagi yorqin hududlar yangi fast-food uchun kuchliroq imkoniyatni bildiradi.": "Brighter map areas indicate stronger opportunities for a new fast-food location.",
	"TANLANGAN JOY NATIJASI": "SELECTED LOCATION RESULT", "Bozor ulushi": "Market share", "Taxminiy mijozlar": "Estimated customers", "Joy tanlanganda uning raqiblarga taxminiy ta’siri ko‘rsatiladi.": "Select a location to see its estimated impact on competitors.",
	"Taxminiy xizmat hududi": "Estimated service area", "Eng yaqin nuqta modeli": "Nearest-location model", "Yangi lokatsiya maydoni": "New location area", "Tanlangan radius": "Selected radius", "Raqiblar o‘rtachasi": "Competitor average", "O‘rtachadan farqi": "Difference from average", "Yangi nuqta": "New location", "Raqib o‘rtachasi": "Competitor average",
	"Bu raqam qanday chiqdi?": "How was this calculated?", "Eng yaqin nuqta": "Nearest location", "Hududdagi har bir joy eng yaqin fast-food’ga biriktiriladi.": "Every point in the area is assigned to its nearest fast-food location.", "Radius bilan kesish": "Clip to radius", "Faqat siz tanlagan doira ichidagi maydon qoldiriladi.": "Only the area inside your selected radius is kept.", "Raqib bilan solishtirish": "Compare with competitors", "Yangi hudud yaqin raqiblarning o‘rtacha maydoni bilan taqqoslanadi.": "The new area is compared with the average area of nearby competitors.",
	"Masofa bo‘yicha zichlik": "Density by distance", "500 metr ichida": "Within 500 meters", "1 kilometr ichida": "Within 1 kilometer", "2 kilometr ichida": "Within 2 kilometers", "Eng yaqin raqobatchi": "Nearest competitor", "Tahlil izohi": "Analysis insight",
	"AI FEEDBACK": "AI FEEDBACK", "Bu tavsiya foydali bo‘ldimi?": "Was this recommendation useful?", "Javob keyingi scoring modelini yaxshilashga yordam beradi.": "Your answer helps improve the next scoring model.", "Ha": "Yes", "Yo‘q": "No", "Nima mos kelmadi?": "What was wrong?", "Raqamlar noto‘g‘ri": "The numbers are incorrect", "Xulosa tushunarsiz": "The conclusion is unclear", "Joyni bilaman — mos emas": "I know the area — it is unsuitable", "Ma’lumot yetishmaydi": "Data is missing", "Rahmat, javob saqlandi.": "Thank you, your feedback was saved.",
	"Hisobotni saqlash": "Save report", "Mening hisobotlarim": "My reports", "Hali hisobot yo‘q": "No reports yet", "Saqlangan lokatsiya tahlillari shu yerda jamlanadi.": "Saved location analyses are collected here.", "Birinchi lokatsiyani tahlil qilganingizdan so‘ng hisobot shu yerda ko‘rinadi.": "Your first saved analysis will appear here.",
	"A / B TAQQOSLASH": "A / B COMPARISON", "Qaysi lokatsiya kuchliroq?": "Which location is stronger?", "Bir xil radiusdagi signallar": "Signals within the same radius", "AI TAVSIYASI": "AI RECOMMENDATION", "Ikki lokatsiyaning biznes signallari solishtirilmoqda.": "Comparing business signals for both locations.", "Asosiy xavf aniqlanadi.": "The main risk will be identified.", "Taqqoslashni saqlash": "Save comparison",
	"Xaritadan nuqtani tanlang": "Select a point on the map", "Oldingi ko‘rinish": "Previous view", "TARMOQ FILTRI": "CHAIN FILTER", "Xizmat hududi xaritasi": "Service area map", "Yangi lokatsiya": "New location", "Sizning nuqtangiz eng yaqin bo‘lgan hudud": "Area where your location is the nearest", "Raqib hududlari": "Competitor areas", "Boshqa fast-food’lar yaqinroq bo‘lgan joylar": "Areas where another fast-food location is closer", "Hudud markazi": "Area center", "Hududni yaratgan haqiqiy fast-food nuqtasi": "The actual fast-food location that generated the area", "Tahlil chegarasi": "Analysis boundary", "Siz tanlagan radius doirasi": "Your selected radius", "Joy imkoniyati": "Location opportunity", "Past": "Low", "Yuqori": "High",
	"Joyni tahlil qilish": "Analyze a location", "Joylarni topish": "Find locations", "Lokatsiyalarni taqqoslash": "Compare locations", "Qidiruv markazini belgilang": "Select a search area", "Eng yaxshi lokatsiyalar qidiriladigan hudud markazini tanlang.": "Choose the area where the best locations should be found.", "Ikki lokatsiyani belgilang": "Select two locations", "A va B nuqtalarni xaritadan tanlang. Ikkalasi bir xil radiusda solishtiriladi.": "Select points A and B on the map. Both will be compared using the same radius.", "Lokatsiyalarni topish": "Find locations", "Lokatsiyalarni taqqoslash": "Compare locations",
	"Ochish tavsiya etiladi": "Recommended to open", "Ehtiyotkorlik bilan ochish mumkin": "Possible with caution", "Hozircha tavsiya etilmaydi": "Not recommended yet",
	"Atrofdagi talab oqimi kuchli": "Strong demand flow nearby", "Avtobus orqali kelish qulay": "Convenient bus access", "Metro mijoz oqimini qo‘llab-quvvatlaydi": "Metro supports customer flow", "Asosiy yo‘l ko‘rinuvchanlik beradi": "Main road provides visibility", "Raqobat bosimi nisbatan past": "Competition pressure is relatively low", "Taxminiy xizmat hududi qulay": "Estimated service area is favorable",
	"Yaqin talab generatorlari yetarli emas": "Not enough nearby demand generators", "Jamoat transporti oqimi zaif": "Public transit flow is weak", "Asosiy yo‘lga chiqish kuchsiz": "Weak access to a main road", "Xizmat hududi raqiblar fonida kichik": "Service area is small compared with competitors", "Ijara va real piyoda oqimi joyida tekshirilishi kerak": "Rent and actual foot traffic must be verified on site",
	"Raqobat imkoniyati": "Competition opportunity", "Brand kuchi, masofa va xizmat zonasi": "Brand strength, distance and service overlap", "Talab oqimi": "Demand flow", "Yaqindagi mijoz generatorlari": "Nearby customer generators", "Bekat masofasi va qamrovi": "Station distance and coverage", "Bekatlar soni va yaqinligi": "Stop count and proximity", "Asosiy yo‘l": "Main road", "Yo‘l oqimi va ko‘rinuvchanlik": "Road flow and visibility", "Xizmat hududi": "Service area", "Raqiblar orasidagi bazaviy maydon": "Baseline area among competitors",
	"Lokatsiyada muvozanatli bazaviy signallar bor": "The location has balanced baseline signals", "Universal fast-food": "Universal fast food", "Family fast-food": "Family fast food", "Roadside fast-food": "Roadside fast food",
	"Menyuni universal saqlang, lekin eng kuchli mahalliy auditoriya uchun bitta aniq ustunlik yarating.": "Keep the menu broad, but create one clear advantage for the strongest local audience.", "Oilaviy setlar, qulay o‘tirish joyi va kechki vaqt servisiga urg‘u bering.": "Prioritize family meals, comfortable seating and evening service.", "Kirish-chiqish, parking va yo‘ldan ko‘rinadigan tashqi belgini joyida tekshiring.": "Verify access, parking and roadside signage on site.", "Arzon combo, tez servis va tushlik vaqtiga mos menyu bilan talab oqimini ushlang.": "Capture demand with affordable combos, fast service and a lunch-focused menu.", "Zal hajmini oshirishdan ko‘ra yetkazib berish tezligi, kechki menyu va raqiblardan farqli taklifga sarmoya kiriting.": "Invest in delivery speed, an evening menu and differentiation rather than a larger dining area.",
	"Endi B lokatsiyani xaritadan belgilang.": "Now select location B on the map.", "Nuqtani almashtirish uchun A yoki B kartasini bosing.": "Select card A or B to change its point.",
	"800 metr ichida avtobus bekati topilmadi. Lokatsiya jamoat transportidan keladigan oqimga kamroq tayanadi.": "No bus stop was found within 800 meters. The location relies less on public-transit traffic.",
	"Bekat juda yaqin va atrofda bir nechta yo‘nalish nuqtalari bor. Bu piyoda yo‘lovchilar oqimi uchun kuchli signal.": "A stop is very close and several transit points are nearby. This is a strong pedestrian-flow signal.",
	"Avtobusga chiqish qulayligi o‘rtacha. Bekatdan lokatsiyagacha xavfsiz piyoda yo‘lini joyida tekshirish kerak.": "Bus access is moderate. Verify a safe walking route from the stop to the location.",
	"Yaqin avtobus bekatlari kam yoki uzoq. Bu joy ko‘proq mahalliy aholi va avtomobil oqimiga tayanishi mumkin.": "Nearby bus stops are sparse or distant. This location may rely more on local residents and car traffic.",
	"Atrofda turli auditoriyalarni olib keladigan obyektlar zich. Kunning bir necha vaqtida mijoz oqimi bo‘lishi mumkin.": "Nearby places attract diverse audiences, potentially creating customer flow across several dayparts.",
	"Talab generatorlari yetarli, ammo oqim ayrim auditoriya yoki vaqt oralig‘iga bog‘liq bo‘lishi mumkin.": "Demand generators are sufficient, but traffic may depend on a specific audience or time of day.",
	"Yaqin atrofdagi talab generatorlari kam. Lokatsiya ko‘proq mahalliy aholi yoki avtomobil oqimiga tayanishi mumkin.": "Nearby demand generators are limited. The location may rely more on local residents or car traffic.",
	"Lokatsiya kuchli avtomobil oqimi proksisiga ega asosiy yo‘lga yaqin. Haqiqiy kirish va parking imkoniyatini joyida tekshirish kerak.": "The location is near a main road with a strong traffic proxy. Verify actual access and parking on site.",
	"Asosiy yo‘lga chiqish imkoniyati o‘rtacha. Ko‘rinuvchanlik va burilish qulayligi natijani sezilarli o‘zgartirishi mumkin.": "Main-road access is moderate. Visibility and turning access may significantly change the result.",
	"Lokatsiya asosiy avtomobil yo‘llaridan uzoqroq. U ko‘proq piyoda yoki mahalliy mijoz oqimiga tayanadi.": "The location is farther from main roads and relies more on pedestrians or local customers.",
	"Ta’sirni hisoblash uchun yaqin raqib topilmadi.": "No nearby competitor was found for impact estimation.", "2 km atrofida raqobatchi topilmadi.": "No competitor was found within 2 km.",
} ) )

const sources = new WeakMap()
const attributeSources = new WeakMap()
let currentLanguage = "en"
let observer

const rules = [
	[/^(\d+)% ishonch$/, "$1% confidence"], [/^(\d+) ta filial$/, "$1 branches"], [/^(\d+) ta$/, "$1"], [/^(\d+) ball$/, "$1 points"],
	[/^(.*) tumani$/, "$1 district"], [/^(.*) uchun (\d+) ta joy$/, "$1: $2 locations"], [/^(\d+) km radius$/, "$1 km radius"],
	[/^Mos format: (.*) · AI ball (\d+)\/100$/, "Best format: $1 · AI score $2/100"], [/^Asosiy xavf: (.*)\.$/, "Main risk: $1."],
	[/^Eng kuchli xavf: (.*)$/, "Strongest threat: $1"], [/^Talab (\d+)\/100$/, "Demand $1/100"], [/^Raqobat (\d+)\/100$/, "Competition $1/100"],
]

const phrases = [
	[ "Tumanni xaritadan yoki ro‘yxatdan tanlang", "Select a district on the map or from the list" ],
	[ "A yoki B kartasini tanlab nuqtani o‘zgartiring", "Select card A or B to change its point" ], [ "B lokatsiyani belgilang", "Select location B" ], [ "A lokatsiyani belgilang", "Select location A" ],
	[ "Barcha qatlamlarni qaytarish", "Restore all layers" ], [ "Bu nuqtani chuqur tahlil qilish", "Analyze this point in depth" ], [ "Shu lokatsiyani tahlil qilish", "Analyze this location" ], [ "Shu tumanda joy topish", "Find a location in this district" ],
	[ "Tavsiya etilgan lokatsiyalar", "Recommended locations" ], [ "Mos lokatsiya topilmadi", "No suitable location found" ], [ "Mos fast food topilmadi", "No matching fast food found" ], [ "TAVSIYA ETILGAN JOY", "RECOMMENDED LOCATION" ],
	[ "Tuman ma’lumotlari", "District information" ], [ "TUMAN MA’LUMOTLARI", "DISTRICT INFORMATION" ], [ "Aholi zichligi", "Population density" ], [ "Bu tuman bo‘yicha umumiy statistika", "General statistics for this district" ],
	[ "Chuqur tahlil bilan bir xil AI modeli bo‘yicha", "Using the same AI model as the in-depth analysis" ], [ "minimum chegaradan o‘tgan", "that passed the minimum threshold" ], [ "ta joy topildi", "locations were found" ],
	[ "tanlangan radius bo‘yicha tavsiya qilishga yetarli signalga ega joy topilmadi", "no location had enough signal to be recommended for the selected radius" ], [ "Radiusni o‘zgartirib qayta tekshiring", "Change the radius and try again" ],
	[ "Raqobat muvozanatli", "Competition is balanced" ], [ "Bevosita raqobat past", "Direct competition is low" ], [ "raqobat bosimi", "competition pressure" ], [ "Raqobat ta’siri", "Competition impact" ], [ "Pastroq yaxshi", "Lower is better" ],
	[ "standart raqibga teng ta’sir", "standard-competitor equivalent impact" ], [ "Eng kuchli xavf", "Strongest threat" ], [ "RAQIB XIZMAT HUDUDI", "COMPETITOR SERVICE AREA" ], [ "YANGI LOKATSIYA HUDUDI", "NEW LOCATION AREA" ],
	[ "Metro ma’lumoti mavjud emas", "Metro data is unavailable" ], [ "Metro signali yo‘q", "No metro signal" ], [ "metro signali yo‘q", "no metro signal" ], [ "Avtobus signali yo‘q", "No bus signal" ], [ "Bekat topilmadi", "No station found" ], [ "Bekat yo‘q", "No station" ],
	[ "Nomsiz avtobus bekati", "Unnamed bus stop" ], [ "Nomsiz bekat", "Unnamed stop" ], [ "Nomsiz yo‘l", "Unnamed road" ], [ "Asosiy yo‘l topilmadi", "No main road found" ], [ "Asosiy yo‘l yo‘q", "No main road" ],
	[ "METRO BEKATI", "METRO STATION" ], [ "METRO KIRISHI", "METRO ENTRANCE" ], [ "AVTOBUS BEKATI", "BUS STOP" ], [ "YO‘L OQIMI PROKSI", "ROAD FLOW PROXY" ], [ "TALAB GENERATORI", "DEMAND GENERATOR" ],
	[ "Hisobotni o‘chirish", "Delete report" ], [ "Hisobotlarda", "In reports" ], [ "Saqlandi", "Saved" ], [ "Ko‘rish", "View" ], [ "Imkoniyat", "Opportunity" ], [ "Yangi joyni tanlash ehtimoli", "Likelihood of choosing the new location" ],
	[ "Mijoz", "Customer" ], [ "mijoz", "customer" ], [ "Talab", "Demand" ], [ "talab", "demand" ], [ "Raqobat", "Competition" ], [ "raqobat", "competition" ], [ "avtobus", "bus" ], [ "yo‘l", "road" ],
	[ "bozor ulushi", "market share" ], [ "aholi", "people" ], [ "ta bekat", "stops" ], [ "ta filial", "branches" ], [ "ta kirish nuqtasi", "entrances" ], [ "ta talab generatori", "demand generators" ], [ "ta raqobatchi", "competitors" ],
	[ "yuqori", "higher" ], [ "past", "lower" ], [ "kattaroq", "larger" ], [ "kichikroq", "smaller" ], [ "Raqib yo‘q", "No competitor" ], [ "Signal yo‘q", "No signal" ],
].sort( ( first, second ) => second[ 0 ].length - first[ 0 ].length )

const translate = value => {
	const trimmed = value.trim()
	if( !trimmed ) {return value}
	let translated = uzToEn.get( trimmed )
	if( !translated ) {
		for( const [ pattern, replacement ] of rules ) {
			if( pattern.test( trimmed ) ) { translated = trimmed.replace( pattern, replacement ); break }
		}
	}
	if( !translated ) {
		translated = trimmed
		for( const [ source, target ] of phrases ) {
			translated = translated.replaceAll( source, target )
		}
		if( translated === trimmed ) {
			translated = null
		}
	}
	return translated ? value.replace( trimmed, translated ) : value
}

const translateNode = node => {
	if( node.nodeType === Node.TEXT_NODE ) {
		const translated = translate( node.nodeValue )
		if( translated !== node.nodeValue ) { sources.set( node, node.nodeValue ); node.nodeValue = translated }
		return
	}
	if( node.nodeType !== Node.ELEMENT_NODE || node.closest?.( "[data-no-i18n]" ) ) {return}
	const stored = {}
	for( const attribute of [ "placeholder", "aria-label", "title" ] ) {
		if( node.hasAttribute( attribute ) ) {
			const value = node.getAttribute( attribute ); const translated = translate( value )
			if( translated !== value ) { stored[ attribute ] = value; node.setAttribute( attribute, translated ) }
		}
	}
	if( Object.keys( stored ).length ) {attributeSources.set( node, stored )}
	for( const child of node.childNodes ) {translateNode( child )}
}

const restoreNode = node => {
	if( node.nodeType === Node.TEXT_NODE ) { if( sources.has( node ) ) {node.nodeValue = sources.get( node );} return }
	if( node.nodeType !== Node.ELEMENT_NODE ) {return}
	const stored = attributeSources.get( node ) || {}
	for( const [ attribute, value ] of Object.entries( stored ) ) {node.setAttribute( attribute, value )}
	for( const child of node.childNodes ) {restoreNode( child )}
}

const observe = root => {
	observer?.disconnect()
	observer = new MutationObserver( mutations => {
		observer.disconnect()
		if( currentLanguage === "en" ) {mutations.forEach( mutation => {
			if( mutation.type === "characterData" ) {translateNode( mutation.target )}
			mutation.addedNodes.forEach( translateNode )
		} )}
		observer.observe( root, { childList: true, subtree: true, characterData: true } )
	} )
	observer.observe( root, { childList: true, subtree: true, characterData: true } )
}

export function setupI18n( root ) {
	const saved = localStorage.getItem( "ummon-language" )
	currentLanguage = saved === "uz" ? "uz" : "en"
	const apply = language => {
		observer?.disconnect(); currentLanguage = language; document.documentElement.lang = language
		if( language === "en" ) {translateNode( root );} else {restoreNode( root )}
		root.querySelectorAll( "[data-language]" ).forEach( button => {
			button.classList.toggle( "is-active", button.dataset.language === language )
			button.setAttribute( "aria-pressed", String( button.dataset.language === language ) )
		} )
		localStorage.setItem( "ummon-language", language ); observe( root )
	}
	root.querySelectorAll( "[data-language]" ).forEach( button => button.addEventListener( "click", () => apply( button.dataset.language ) ) )
	apply( currentLanguage )
}
