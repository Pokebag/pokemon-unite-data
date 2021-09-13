/* eslint-disable */
// Module imports
import fetch from 'node-fetch'
import fs from 'fs-extra'
import path from 'path'





function convertPokemonNameToID(name) {
	return name.toLowerCase().replace(/\W/g, '-')
}

function fetchJSON(url, options = {}) {
	return fetch(url, options)
		.then(response => response.json())
}

function normalizePokemon(options) {
	const {
		moveTypes,
		pokemon,
		pokemonHash,
		rsbHash,
		skillHash,
	} = options

	if (pokemon.name === 'Ninetales') {
		pokemon.name = 'Alolan Ninetales'
	}

	const pokemonID = convertPokemonNameToID(pokemon.name)

	pokemon.damageType = pokemon.damage_type.toLowerCase()
	pokemon.displayName = pokemon.name
	pokemon.id = pokemonID
	pokemon.ratings = pokemon.stats

	pokemon.evolutions = pokemon.evolution.reduce((accumulator, evolution) => {
		if (evolution.name) {
			accumulator.push({
				name: evolution.name,
				level: Number(evolution.level),
			})
		}

		return accumulator
	}, [])

	pokemon.skills.forEach(skill => normalizeSkill({
		pokemonID,
		rsbHash,
		skill,
		skillHash,
		types: moveTypes,
	}))

	delete pokemon.builds
	delete pokemon.damage_type
	delete pokemon.display_name
	delete pokemon.evolution
	delete pokemon.name
	delete pokemon.skills
	delete pokemon.stats
	delete pokemon.soon
	delete pokemon.tier
	delete pokemon.tier_change
	delete pokemon.true_stats

	pokemonHash[pokemonID] = pokemon
}

function normalizeRSB(options) {
	const {
		pokemonID,
		rsb,
		rsbHash,
		skillID,
	} = options

	if (rsb.base !== null) {
		const rsbID = `${skillID}-rsb`

		rsbHash[rsbID] = {
			id: rsbID,
			pokemonID,
			hits: [],
			skillID,
		}

		rsbHash[rsbID].hits.push({
			base: Number(rsb.base),
			damageType: rsb.dmg_type,
			label: rsb.label,
			ratio: Number(rsb.ratio),
			slider: Number(rsb.slider),
		})

		let addIndex = 0

		while (addIndex <= 3) {
			addIndex += 1

			if (rsb[`add${addIndex}_base`]) {
				rsbHash[rsbID].hits.push({
					base: Number(rsb[`add${addIndex}_base`]),
					damageType: rsb[`add${addIndex}_dmg_type`],
					label: rsb[`add${addIndex}_label`],
					ratio: Number(rsb[`add${addIndex}_ratio`]),
					slider: Number(rsb[`add${addIndex}_slider`]),
				})
			}
		}

		if (rsb.enhanced_base) {
			let enhancedRSBID = `${skillID}+-rsb`

			rsbHash[enhancedRSBID] = {
				id: enhancedRSBID,
				pokemonID,
				hits: [],
				skillID: `${skillID}+`,
			}

			rsbHash[enhancedRSBID].hits.push({
				base: Number(rsb.enhanced_base),
				damageType: rsb.enhanced_dmg_type,
				label: rsb.enhanced_label,
				ratio: Number(rsb.enhanced_ratio),
				slider: Number(rsb.enhanced_slider),
			})

			let enhancedAddIndex = 0
			while (enhancedAddIndex <= 2) {
				enhancedAddIndex += 1

				if (rsb[`enhanced_add${enhancedAddIndex}_base`]) {
					rsbHash[enhancedRSBID].hits.push({
						base: Number(rsb[`enhanced_add${enhancedAddIndex}_base`]),
						damageType: rsb[`enhanced_add${enhancedAddIndex}_dmg_type`],
						label: rsb[`enhanced_add${enhancedAddIndex}_label`],
						ratio: Number(rsb[`enhanced_add${enhancedAddIndex}_ratio`]),
						slider: Number(rsb[`enhanced_add${enhancedAddIndex}_slider`]),
					})
				}
			}
		}
	}
}

function normalizeSkill(options) {
	const {
		choice,
		parentSkill,
		pokemonID,
		rsbHash,
		skill,
		skillHash,
		types,
	} = options

	const skillID = `${pokemonID}-${skill.name.toLowerCase().replace(/\s/g, '-')}`

	skill.pokemonID = pokemonID
	skill.upgradeIDs = []

	// slot 0 === passive ability
	// slot 1 === basic attack
	// slot 2 === special attack 1
	// slot 3 === special attack 2
	// slot 4 === unite
	if (parentSkill) {
		skill.slot = parentSkill.slot
		skill.parentID = parentSkill.id
		skill.tier = 1
		parentSkill.upgradeIDs.push(skillID)
	} else {
		skill.parentID = null
		skill.tier = 0

		switch(skill.ability) {
			case 'Passive':
				skill.slot = 0
				break

			case 'Basic':
				skill.slot = 1
				break

			case 'Move 1':
				skill.slot = 2
				break

			case 'Move 2':
				skill.slot = 3
				break

			case 'Unite Move':
				skill.slot = 4
				break
		}
	}

	skill.choice = choice || 0

	skill.displayName = skill.name
	skill.id = skillID

	delete skill.ability
	delete skill.name

	skill.level = skill.level ? Number(skill.level) : 1

	if (skill.rsb?.base) {
		normalizeRSB({
			pokemonID,
			rsb: skill.rsb,
			rsbHash,
			skillID,
		})
	}
	delete skill.rsb

	const moveType = types.indexOf(skill.type)
	if (skill.type) {
		if (moveType !== -1) {
			skill.type = moveType
		} else {
			types.push(skill.type)
			skill.type = skill.type.length - 1
		}
	}

	if (skill.upgrades) {
		skill.upgrades.forEach((upgrade, index) => normalizeSkill({
			choice: index,
			parentSkill: skill,
			pokemonID,
			rsbHash,
			skill: upgrade,
			skillHash,
			types,
		}))
	}
	delete skill.upgrades

	if (skill.cd || skill.cd1) {
		skill.cooldown = parseFloat(skill.cd || skill.cd1)
	}
	delete skill.cd
	delete skill.cd1

	if (skill.description2 && skill.level2) {
		const tempSkillID = `${skillID}+`

		skillHash[tempSkillID] = {
			choice: skill.choice,
			cooldown: skill.cooldown,
			displayName: `${skill.displayName}+`,
			description: `${skill.description1}\n\n${skill.description2}`,
			id: tempSkillID,
			level: Number(skill.level2),
			parentID: skillID,
			pokemonID,
			slot: skill.slot,
			tier: 2,
			type: skill.type,
			upgradeIDs: [],
		}

		skill.upgradeIDs.push(tempSkillID)
	}
	delete skill.description2
	delete skill.level2

	if (skill.description1 && skill.level1) {
		skill.description = skill.description1
		skill.level = skill.level1
	}
	delete skill.description1
	delete skill.level1

	skillHash[skillID] = skill
}

async function normalizeDataFromUniteDB() {
	const moveTypes = []
	const pokemon = {}
	const rsbs = {}
	const skills = {}

	const [
		pokemonDatasets,
		statsDatasets,
	] = await Promise.all([
		fetchJSON('https://unite-db.com/pokemon.json'),
		fetchJSON('https://unite-db.com/stats.json'),
	])

	pokemonDatasets.forEach(pokemonData => {
		normalizePokemon({
			pokemon: pokemonData,
			pokemonHash: pokemon,
			rsbHash: rsbs,
			skillHash: skills,
			moveTypes,
		})
	})

	statsDatasets.forEach(statsData => {
		if (statsData.name === 'Ninetales') {
			statsData.name = 'Alolan Ninetales'
		}
		const pokemonID = convertPokemonNameToID(statsData.name)
		pokemon[pokemonID].stats = statsData.level.map(statBlock => {
			statBlock.spAttack = statBlock.sp_attack
			statBlock.spDefense = statBlock.sp_defense
			delete statBlock.sp_attack
			delete statBlock.sp_defense
			return statBlock
		})
	})

	const pokemonLaunchPatches = {
		blastoise: '1.1.1.7',
		blissey: '1.1.1.6',
		gardevoir: '1.1.1.3',
	}

	const pokemonDataPaths = Object.keys(pokemon).reduce((accumulator, pokemonID) => {
		const patchVersion = pokemonLaunchPatches[pokemonID] || 'base'
		const dataFilesPath = path.resolve(process.cwd(), 'data', patchVersion)

		accumulator[pokemonID] = {
			pokemonFilesPath: path.resolve(dataFilesPath, 'pokemon'),
			skillsFilesPath: path.resolve(dataFilesPath, 'skills'),
			rsbsFilesPath: path.resolve(dataFilesPath, 'rsbs'),
		}

		return accumulator
	}, {})

	console.log('Writing Pokémon...')
	await writeFiles(pokemon, pokemonDataPaths, 'pokemonFilesPath', item => item.id)
	console.log('Done.')

	console.log('Writing Skills...')
	await writeFiles(skills, pokemonDataPaths, 'skillsFilesPath', item => item.pokemonID)
	console.log('Done.')

	console.log('Writing RSBs...')
	await writeFiles(rsbs, pokemonDataPaths, 'rsbsFilesPath', item => item.pokemonID)
	console.log('Done.')

	console.log(Object.entries(moveTypes))
}

async function writeFiles(itemsToWrite, dataPaths, dataPathKey, getPokemonID) {
	const entries = Object.entries(itemsToWrite)
	let index = 0

	while (index < entries.length) {
		try {
			const [itemID, itemData] = entries[index]
			const pokemonID = getPokemonID(itemData)

			const dataPath = dataPaths[pokemonID][dataPathKey]

			const destinationFilepath = path.resolve(dataPath, `${itemID}.json`)
			const dataString = JSON.stringify(itemData, null, 2)

			await fs.ensureDir(dataPath)
			await fs.writeFile(destinationFilepath, dataString, 'utf-8')

			index += 1
		} catch (error) {
			console.log('Error writing files:', error)
		}
	}
}





(async () => {
	try {
		await normalizeDataFromUniteDB()
	} catch (error) {
		console.log(error)
	}
})()
