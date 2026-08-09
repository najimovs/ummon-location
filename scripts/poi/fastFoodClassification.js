export const fastFoodClassification = {
	osm: {
		direct: new Set( [ "fast_food" ] ),
		indirect: new Set( [ "restaurant", "cafe", "food_court", "ice_cream" ] ),
	},
	foursquare: {
		direct: new Set( [
			"Burger Joint",
			"Burrito Restaurant",
			"Falafel Restaurant",
			"Fast Food Restaurant",
			"Fish and Chips Shop",
			"Food Court",
			"Food Stand",
			"Food Truck",
			"Fried Chicken Joint",
			"Hot Dog Joint",
			"Kebab Restaurant",
			"Mac and Cheese Joint",
			"Pizzeria",
			"Sandwich Spot",
			"Shawarma Restaurant",
			"Snack Place",
			"Taco Restaurant",
			"Wings Joint",
		] ),
		indirect: new Set( [
			"Bakery",
			"Breakfast Spot",
			"Café",
			"Cafeteria",
			"Coffee Shop",
			"Dessert Shop",
			"Diner",
			"Ice Cream Parlor",
			"Restaurant",
			"Tea Room",
		] ),
	},
	overture: {
		direct: new Set( [
			"burger_restaurant",
			"burrito_restaurant",
			"chicken_restaurant",
			"doner_kebab",
			"doner_kebab_restaurant",
			"fast_food_restaurant",
			"fish_and_chips_restaurant",
			"food_stand",
			"food_truck",
			"hot_dog_restaurant",
			"pizza_delivery_service",
			"pizza_restaurant",
			"sandwich_shop",
		] ),
		indirect: new Set( [
			"bakery",
			"breakfast_and_brunch_restaurant",
			"cafe",
			"cafeteria",
			"coffee_shop",
			"dessert_shop",
			"desserts",
			"ice_cream_shop",
			"restaurant",
			"tea_room",
		] ),
	},
	nameKeywords: [
		"burger",
		"chicken",
		"doner",
		"fast food",
		"fastfood",
		"hot dog",
		"kebab",
		"lavash",
		"pizza",
		"sendvich",
		"shaorma",
		"shaurma",
		"shawarma",
		"street food",
	],
}

const includesValue = ( values, allowedValues ) => values.some( value => allowedValues.has( value ) )

const hasNameKeyword = name => {
	const normalizedName = String( name ?? "" ).toLocaleLowerCase()
	return fastFoodClassification.nameKeywords.some( keyword => normalizedName.includes( keyword ) )
}

export function classifyOsm( properties ) {
	const category = properties.AMENITY

	if( fastFoodClassification.osm.direct.has( category ) ) {
		return { type: "direct", reason: `AMENITY=${ category }` }
	}
	if( fastFoodClassification.osm.indirect.has( category ) ) {
		return { type: "indirect", reason: `AMENITY=${ category }` }
	}
	if( hasNameKeyword( properties.NAME ) ) {
		return { type: "review", reason: "name keyword" }
	}

	return { type: "excluded", reason: "not food-related" }
}

export function classifyFoursquare( properties ) {
	if( properties.closed ) {
		return { type: "excluded", reason: "closed" }
	}

	const categories = [ properties.cat_name, properties.cat2_name, properties.cat3_name ]
		.filter( Boolean )

	if( includesValue( categories, fastFoodClassification.foursquare.direct ) ) {
		return { type: "direct", reason: "direct category" }
	}
	if( includesValue( categories, fastFoodClassification.foursquare.indirect ) ) {
		return { type: "indirect", reason: "adjacent category" }
	}
	if( hasNameKeyword( properties.name ) ) {
		return { type: "review", reason: "name keyword" }
	}

	return { type: "excluded", reason: "not food-related" }
}

export function classifyOverture( properties ) {
	if( properties.op_status && properties.op_status !== "open" ) {
		return { type: "excluded", reason: `status=${ properties.op_status }` }
	}

	const categories = [
		properties.categories?.primary,
		...( properties.categories?.alternate ?? [] ),
		properties.basic_cat,
		properties.taxonomy?.primary,
	].filter( Boolean )

	if( includesValue( categories, fastFoodClassification.overture.direct ) ) {
		return { type: "direct", reason: "direct category" }
	}
	if( includesValue( categories, fastFoodClassification.overture.indirect ) ) {
		return { type: "indirect", reason: "adjacent category" }
	}
	if( hasNameKeyword( properties.names_pri ) ) {
		return { type: "review", reason: "name keyword" }
	}

	return { type: "excluded", reason: "not food-related" }
}
