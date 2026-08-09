const clamp = value => Math.max( 0, Math.min( 100, value ) )

const subtypeWeights = {
	burger: 1,
	chicken: 1,
	doner_kebab: 1,
	general_fast_food: 0.92,
	pizza: 0.88,
	sandwich: 0.82,
	bakery: 0.62,
}

const getBrandKey = feature => feature.properties.brandId || feature.properties.name?.trim().toLocaleLowerCase( "uz" ) || feature.properties.id

export function createCompetitionModel( features ) {
	const brandPresence = new Map()
	features.forEach( feature => {
		const key = getBrandKey( feature )
		brandPresence.set( key, ( brandPresence.get( key ) || 0 ) + 1 )
	} )

	return ( location, distanceMeters, options = {} ) => {
		const radius = Math.max( 250, Number( options.radius ) || 1000 )
		const contextRadius = Math.max( 2000, radius * 1.35 )
		const competitors = features.flatMap( feature => {
			if( feature.properties.id === options.excludeId ) {
				return []
			}
			const distance = distanceMeters( location, feature.geometry.coordinates )
			if( distance <= 3 || distance > contextRadius ) {
				return []
			}
			const branchCount = brandPresence.get( getBrandKey( feature ) ) || 1
			const brandStrength = Math.min( 1.65, 1 + Math.log2( branchCount ) * 0.13 )
			const categoryStrength = subtypeWeights[ feature.properties.subtype ] || 0.75
			const distanceStrength = Math.exp( -distance / 620 )
			const overlap = clamp( ( 1 - distance / ( radius * 1.45 ) ) * 100 ) / 100
			const confidence = 0.82 + Number( feature.properties.confidence || 0.65 ) * 0.18
			const contribution = brandStrength * categoryStrength * confidence * ( distanceStrength * 0.7 + overlap * 0.3 )
			return [ { feature, distance, branchCount, brandStrength, categoryStrength, overlap, contribution } ]
		} ).sort( ( first, second ) => second.contribution - first.contribution )

		const withinRadius = competitors.filter( item => item.distance <= radius )
		const weightedTotal = competitors.reduce( ( sum, item ) => sum + item.contribution, 0 )
		const pressureScore = Math.round( clamp( 100 * ( 1 - Math.exp( -weightedTotal / 7.2 ) ) ) )
		const equivalentCompetitors = Number( weightedTotal.toFixed( 1 ) )
		const topThreat = competitors[ 0 ] || null
		const pressureLevel = pressureScore >= 70 ? "Yuqori" : pressureScore >= 35 ? "O‘rtacha" : "Past"

		return {
			competitors,
			withinRadius,
			pressureScore,
			pressureLevel,
			equivalentCompetitors,
			topThreat,
			bands: {
				within500: competitors.filter( item => item.distance <= 500 ),
				within1000: competitors.filter( item => item.distance <= 1000 ),
				within2000: competitors.filter( item => item.distance <= 2000 ),
			},
		}
	}
}

export function explainCompetitionThreat( threat, cleanName, formatDistance ) {
	if( !threat ) {
		return "Yaqin hududda sezilarli raqobat xavfi topilmadi."
	}
	const brandLabel = threat.branchCount > 1 ? `${ threat.branchCount } filialli tarmoq` : "mustaqil nuqta"
	const overlapLabel = threat.overlap >= 0.65 ? "xizmat hududi kuchli kesishadi" : threat.overlap >= 0.3 ? "xizmat hududi qisman kesishadi" : "xizmat hududi kam kesishadi"
	return `${ cleanName( threat.feature.properties.brandName || threat.feature.properties.name ) } — ${ formatDistance( threat.distance ) }, ${ brandLabel }, ${ overlapLabel }.`
}
