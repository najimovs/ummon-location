const storageKey = "ummon-ai-feedback"

const readFeedback = () => {
	try {
		const records = JSON.parse( localStorage.getItem( storageKey ) || "[]" )
		return Array.isArray( records ) ? records : []
	}
	catch {
		return []
	}
}

export function saveAnalysisFeedback( record ) {
	const records = readFeedback().filter( item => item.analysisId !== record.analysisId )
	records.unshift( { id: `${ Date.now() }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`, createdAt: new Date().toISOString(), ...record } )
	localStorage.setItem( storageKey, JSON.stringify( records.slice( 0, 500 ) ) )
}

