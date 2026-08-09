export default [
	{
		"ignores": [
			"**/node_modules/**",
			"**/dist/**",
		],
		"languageOptions": {
			"ecmaVersion": "latest",
			"sourceType": "module"
		},
		"rules": {
			"no-unused-vars": "warn",
			"no-unused-expressions": "warn",
			"prefer-const": "warn",
			"quotes": "warn",
			"no-duplicate-imports": "warn",
			"prefer-arrow-callback": "warn",
			"no-prototype-builtins": "warn",
			"curly": "warn",
			"arrow-spacing": "warn",
			"eqeqeq": "warn",
			"indent": [ "warn", "tab" ],
		}
	}
]
