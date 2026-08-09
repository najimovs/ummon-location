const clamp = value => Math.max( 0, Math.min( 100, Math.round( Number( value ) || 0 ) ) )

const rankSignals = signals => signals.sort( ( first, second ) => second.value - first.value )

export function createLocationAdvice( input ) {
	const competition = clamp( input.competition )
	const demand = clamp( input.demand )
	const metro = clamp( input.metro )
	const transit = clamp( input.transit )
	const road = clamp( input.road )
	const territoryRatio = Math.max( 0, Number( input.territoryRatio ) || 0 )
	const territoryScore = clamp( 45 + ( territoryRatio - 1 ) * 35 )
	const score = clamp( ( 100 - competition ) * 0.3 + demand * 0.25 + metro * 0.12 + transit * 0.15 + road * 0.08 + territoryScore * 0.1 )
	const transport = Math.max( metro, transit )
	const format = road >= 72 && transport < 55
		? "Roadside fast-food"
		: demand >= 72 && transport >= 65
			? "Student / budget"
			: competition >= 62 && demand >= 58
				? "Delivery-first"
				: territoryRatio >= 1.25 && competition < 48
					? "Family fast-food"
					: "Universal fast-food"
	const verdict = score >= 72 ? "Ochish tavsiya etiladi" : score >= 55 ? "Ehtiyotkorlik bilan ochish mumkin" : "Hozircha tavsiya etilmaydi"
	const tone = score >= 72 ? "positive" : score >= 55 ? "caution" : "negative"
	const strengths = rankSignals( [
		{ value: demand, text: "Atrofdagi talab oqimi kuchli" },
		{ value: transit, text: "Avtobus orqali kelish qulay" },
		{ value: metro, text: "Metro mijoz oqimini qo‘llab-quvvatlaydi" },
		{ value: road, text: "Asosiy yo‘l ko‘rinuvchanlik beradi" },
		{ value: 100 - competition, text: "Raqobat bosimi nisbatan past" },
		{ value: territoryScore, text: "Taxminiy xizmat hududi qulay" },
	] ).filter( signal => signal.value >= 58 ).slice( 0, 3 ).map( signal => signal.text )
	const risks = rankSignals( [
		{ value: input.topThreat ? Math.max( 58, competition ) : 0, text: input.topThreat ? `${ input.topThreat } eng kuchli bevosita xavf` : "" },
		{ value: competition, text: `${ input.competitorCount || 0 } ta raqobatchi sabab bosim yuqori` },
		{ value: 100 - demand, text: "Yaqin talab generatorlari yetarli emas" },
		{ value: 100 - transport, text: "Jamoat transporti oqimi zaif" },
		{ value: 100 - road, text: "Asosiy yo‘lga chiqish kuchsiz" },
		{ value: territoryRatio ? clamp( ( 1 - territoryRatio ) * 80 + 40 ) : 45, text: "Xizmat hududi raqiblar fonida kichik" },
	] ).filter( signal => signal.value >= 55 ).slice( 0, 2 ).map( signal => signal.text )
	const confidence = clamp( 62 + Math.min( 18, Math.abs( score - 55 ) * 0.45 ) + [ demand, metro, transit, road ].filter( value => value > 0 ).length * 3 )
	const action = format === "Delivery-first"
		? "Zal hajmini oshirishdan ko‘ra yetkazib berish tezligi, kechki menyu va raqiblardan farqli taklifga sarmoya kiriting."
		: format === "Student / budget"
			? "Arzon combo, tez servis va tushlik vaqtiga mos menyu bilan talab oqimini ushlang."
			: format === "Roadside fast-food"
				? "Kirish-chiqish, parking va yo‘ldan ko‘rinadigan tashqi belgini joyida tekshiring."
				: format === "Family fast-food"
					? "Oilaviy setlar, qulay o‘tirish joyi va kechki vaqt servisiga urg‘u bering."
					: "Menyuni universal saqlang, lekin eng kuchli mahalliy auditoriya uchun bitta aniq ustunlik yarating."

	return { score, verdict, tone, confidence, format, strengths: strengths.length ? strengths : [ "Lokatsiyada muvozanatli bazaviy signallar bor" ], risks: risks.length ? risks : [ "Ijara va real piyoda oqimi joyida tekshirilishi kerak" ], action }
}

export function createComparisonAdvice( first, second ) {
	const winner = first.score === second.score ? null : first.score > second.score ? "A" : "B"
	const stronger = winner === "A" ? first : second
	const weaker = winner === "A" ? second : first
	const difference = Math.abs( first.score - second.score )
	return {
		winner,
		verdict: winner ? `${ winner } lokatsiya AI tomonidan tavsiya etiladi` : "AI bo‘yicha natija teng",
		confidence: clamp( 66 + difference * 1.4 ),
		summary: winner
			? `${ winner } lokatsiya ${ difference } ball oldinda. Uning eng muhim formati — ${ stronger.format }; asosiy farq: ${ stronger.strengths[ 0 ].toLocaleLowerCase( "uz" ) }.`
			: "Ikkala joyning umumiy salohiyati teng. Yakuniy qaror uchun ijara, parking va real piyoda oqimini tekshirish kerak.",
		risk: winner ? weaker.risks[ 0 ] : "Operatsion xarajatlar natijani o‘zgartirishi mumkin",
	}
}
