import { abbreviateNumber } from "js-abbreviation-number"
import * as dateFns from "date-fns"
import { Telegraf } from "telegraf"

import { AllianceChest, AllianceChestResponse, Gatcha, RewardSet } from "./interfaces/alliance-chests"
import { fetchLocalization, LocalizationObject } from "./utils/fetch-localization"
import { fetchDitelp } from "./utils/fetch-ditlep"
import { config } from "./config"
import { sendDiscordMessage } from "./utils/discord"
import { formatWithLocale } from "./utils/format-date"

function findTodayAllianceChest(data: AllianceChestResponse) {
    const today = new Date()

    for (const range of data.dateRanges) {
        const rangeStartDate = new Date(range.start)
        const rangeEndDate = new Date(range.end)

        if (dateFns.isWithinInterval(today, { start: rangeStartDate, end: rangeEndDate })) {
            return {
                id: String(range.chestId),
                startAt: rangeStartDate.toISOString(),
                endAt: rangeEndDate.toISOString()
            }
        }
    }

    return null
}


type RewardDetails = {
    type: string
    quantity: number
}

function getRewardDetails(
    chestData: AllianceChest,
    allRewardSets: RewardSet[],
    allGatcha: Gatcha[]
) {
    const rewards: RewardDetails[] = []

    const rewardSetId = chestData.reward_set
    const gatchaIds = allRewardSets.find(rewardSet => rewardSet.id === rewardSetId)?.gatcha_ids ?? []

    for (const gatchaId of gatchaIds) {
        const gatchaEntry = allGatcha.find(gatcha => gatcha.gatcha_id === gatchaId)

        if (gatchaEntry && gatchaEntry.resource) {
            if (gatchaEntry.resource.seeds) {
                rewards.push({
                    type: "seeds",
                    quantity: gatchaEntry.resource.seeds[0]?.amount || 0
                })
            } else if (gatchaEntry.resource.f) {
                rewards.push({
                    type: "food",
                    quantity: gatchaEntry.resource.f
                })
            } else if (gatchaEntry.resource.c) {
                rewards.push({
                    type: "gems",
                    quantity: gatchaEntry.resource.c
                })
            } else if (gatchaEntry.resource.keys) {
                rewards.push({
                    type: "keys",
                    quantity: gatchaEntry.resource.keys
                })
            } else if (gatchaEntry.resource.trade_tickets) {
                rewards.push({
                    type: "trade_tickets",
                    quantity: gatchaEntry.resource.trade_tickets[0]?.amount || 0
                })
            } else if (gatchaEntry.resource.rarity_seeds) {
                rewards.push({
                    type: "rarity_seeds",
                    quantity: gatchaEntry.resource.rarity_seeds[0]?.amount || 0
                })
            }
        }
    }

    if (rewards.length === 0) {
        throw new Error("Nenhuma recompensa encontrada")
    }

    return rewards
}


async function checkTodayAllianceChest(data: AllianceChestResponse, localization: LocalizationObject) {
    const chest = findTodayAllianceChest(data)

    if (!chest) {
        console.log("Nenhum ID de baú de aliança encontrado para hoje.")
        return null
    }

    const chestData = data.allianceChest[chest.id]

    if (!chestData) {
        console.log(`Dados do baú de aliança não encontrados para o ID: ${chest.id}`)
        return null
    }

    const activityName = localization[chestData.activity_name_tid]
    const rewardDeatils = getRewardDetails(chestData, data.rewardSet, data.gatcha)

    return {
        startAt: chest.startAt,
        endAt: chest.endAt,
        type: chestData.activity,
        activity: activityName,
        rewards: rewardDeatils
    }
}

function formatRewardType(type: string, lang: "br" | "en" | "es" = "br") {
    const maps: Record<string, Record<string, string>> = {
        br: {
            seeds: "Esferas de dragão",
            food: "Comida",
            gems: "Joias",
            keys: "Chaves",
            trade_tickets: "Essências de troca",
            rarity_seeds: "Esferas de raridade"
        },
        en: {
            seeds: "Dragon Orbs",
            food: "Food",
            gems: "Gems",
            keys: "Keys",
            trade_tickets: "Trade Essences",
            rarity_seeds: "Rarity Orbs"
        },
        es: {
            seeds: "Orbes de dragón",
            food: "Comida",
            gems: "Gemas",
            keys: "Llaves",
            trade_tickets: "Esencias de intercambio",
            rarity_seeds: "Orbes de rareza"
        }
    }

    const map = maps[lang] || maps.br

    if (!map[type]) {
        return type
    }

    return map[type]
}

function formatRewardDetails(rewards: RewardDetails[], lang: "br" | "en" | "es" = "br") {
    return rewards.map(reward => `- ${abbreviateNumber(reward.quantity)} ${formatRewardType(reward.type, lang)}`).join("\n")
}

function createAlertMessage(allianceChest: any, lang: "br" | "en" | "es") {
    const startDate = new Date(allianceChest.startAt)
    const endDate = new Date(allianceChest.endAt)
    const duration = dateFns.differenceInDays(endDate, startDate)

    const formattedStartDate = formatWithLocale(startDate, "HH:mm dd-MM", lang)
    const formattedEndDate = formatWithLocale(endDate, "dd-MM", lang)

    const targetScorePerMemberPerDay = 2500
    const targetScorePerMemberTotal = targetScorePerMemberPerDay * duration
    const membersPerAlliance = 20
    const totalChestScore = membersPerAlliance * targetScorePerMemberTotal

    const labels = {
        br: {
            title: "🇧🇷 | Novo Baú de Alianças!",
            activity: "🎯 Atividade",
            period: "⌛️ Período",
            to: "até",
            days: "dias",
            totalGoal: "👥 Meta total",
            individualGoal: "👤 Meta individual",
            rewardsTitle: "📦 Recompensas de baú nível 6"
        },
        en: {
            title: "🇺🇸 | New Alliance Chest!",
            activity: "🎯 Activity",
            period: "⌛️ Period",
            to: "to",
            days: "days",
            totalGoal: "👥 Total Goal",
            individualGoal: "👤 Individual Goal",
            rewardsTitle: "📦 Level 6 Chest Rewards"
        },
        es: {
            title: "🇪🇸 | ¡Nuevo Cofre de Alianza!",
            activity: "🎯 Actividad",
            period: "⌛️ Período",
            to: "hasta",
            days: "días",
            totalGoal: "👥 Meta total",
            individualGoal: "👤 Meta individual",
            rewardsTitle: "📦 Recompensas del cofre nivel 6"
        }
    }

    const l = labels[lang] || labels.br

    const fromPrefix = lang === 'es' ? 'de ' : (lang === 'en' ? 'from ' : 'de ')

    return `${l.title}\n\n- ${l.activity}: ${allianceChest.activity}\n- ${l.period}: ${fromPrefix}${formattedStartDate} ${l.to} ${formattedEndDate} (${duration} ${l.days})\n- ${l.totalGoal}: ${abbreviateNumber(totalChestScore)}\n- ${l.individualGoal}: ${abbreviateNumber(targetScorePerMemberTotal)}\n\n${l.rewardsTitle}\n\n${formatRewardDetails(allianceChest.rewards, lang)}`
}

async function main() {
    const bot = new Telegraf(config.telegram.botToken)
    const today = new Date()
    const currentMonth = today.getMonth() + 1

    const data = await fetchDitelp<AllianceChestResponse>({
        path: "AllianceChest/Get",
        decrypt: false,
        params: {
            month: currentMonth
        }
    })

    const locBR = await fetchLocalization("br")
    const locEN = await fetchLocalization("en")
    const locES = await fetchLocalization("es")

    const chestBR = await checkTodayAllianceChest(data, locBR)
    const chestEN = await checkTodayAllianceChest(data, locEN)
    const chestES = await checkTodayAllianceChest(data, locES)

    if (chestBR && chestEN && chestES) {
        const msgBR = createAlertMessage(chestBR, "br")
        const msgEN = createAlertMessage(chestEN, "en")
        const msgES = createAlertMessage(chestES, "es")

        const telegramMessages = [msgBR, msgEN, msgES]

        const shouldShowDonateButtons = Math.random() < 0.2

        for (const msg of telegramMessages) {
            await bot.telegram.sendMessage(config.telegram.updatesChannelId, msg, {
                reply_markup: shouldShowDonateButtons ? {
                    inline_keyboard: [
                        [
                            { text: "☕️ Buy me a Coffe", url: "https://buymeacoffee.com/marcuth" }
                        ],
                        [
                            { text: "❤️ Ko-fi", url: "https://ko-fi.com/marcuth" }
                        ],
                        [
                            { text: "💠 Livepix", url: "https://livepix.gg/marcuth" }
                        ],
                        [
                            { text: "🐱 GitHub Sponsors", url: "https://github.com/sponsors/marcuth" }
                        ]
                    ]
                } : undefined
            })
        }

        await sendDiscordMessage(
            config.discord.allianceChestsWebhookUrl,
            [msgBR, msgEN, msgES],
            ["Novo Baú de Alianças!", "New Alliance Chest!", "¡Nuevo Cofre de Alianza!"],
            "<@&1472666645045448807>"
        )
    }
}

if (require.main === module) {
    main()
}