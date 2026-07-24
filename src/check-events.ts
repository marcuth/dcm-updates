import * as dateFns from "date-fns"
import { Telegraf } from "telegraf"

import { fetchLocalization, LocalizationObject } from "./utils/fetch-localization"
import { AllEventsResponse, Event } from "./interfaces/all-events"
import { toTitleCase } from "./utils/to-title-case"
import { fetchDitelp } from "./utils/fetch-ditlep"
import { config } from "./config"
import { sendDiscordMessage } from "./utils/discord"
import { formatWithLocale } from "./utils/format-date"

function filterTodayEvents(events: Event[]) {
    const today = new Date()

    return events.filter(event =>
        dateFns.isSameDay(dateFns.fromUnixTime(event.startTs), today)
    )
}

function normalizeEvents(events: Event[], ditlepLocalization: LocalizationObject, localization: LocalizationObject) {
    return events.map(event => {
        let translatedTitle: string

        if (event.title.includes("Heroic Race")) {
            const [dragonName, eventTitle] = event.title.split("  ")
            const matchedEventTitleKey = Object.keys(ditlepLocalization).find(key => ditlepLocalization[key] === eventTitle)
            const matchedDragonNameKey = Object.keys(localization).find(key => ditlepLocalization[key] === `${dragonName} Dragon`)
            translatedTitle = matchedEventTitleKey && matchedDragonNameKey ? `${localization[matchedEventTitleKey]} do ${localization[matchedDragonNameKey]}` : event.title
        } else {
            const ditlepTitle = event.title
            const matchedKey = Object.keys(ditlepLocalization).find(key => ditlepLocalization[key] === ditlepTitle)
            translatedTitle = matchedKey ? localization[matchedKey] || ditlepTitle : ditlepTitle
        }

        return {
            index: event.index,
            type: event.eventType,
            title: toTitleCase(translatedTitle),
            startAt: new Date(event.startTs * 1000).toISOString(),
            endAt: new Date(event.endTs * 1000).toISOString()
        }
    })
}

function createEventMessage(event: any, lang: "br" | "en" | "es") {
    const startDate = new Date(event.startAt)
    const endDate = new Date(event.endAt)
    const duration = dateFns.differenceInCalendarDays(endDate, startDate)

    const labels = {
        br: {
            alert: "🇧🇷 | Atenção! O evento",
            starts: "começa hoje!",
            period: "📅 Período",
            duration: "⌛ Duração",
            days: "dias",
            at: "às",
            until: "até"
        },
        en: {
            alert: "🇺🇸 | Attention! The event",
            starts: "starts today!",
            period: "📅 Period",
            duration: "⌛ Duration",
            days: "days",
            at: "at",
            until: "until"
        },
        es: {
            alert: "🇪🇸 | ¡Atención! El evento",
            starts: "comienza hoy!",
            period: "📅 Período",
            duration: "⌛ Duración",
            days: "días",
            at: "a las",
            until: "hasta"
        }
    }

    const l = labels[lang] || labels.br

    const dateFormat = lang === 'en' ? `MM-dd '${l.at}' HH:mm` : `dd-MM '${l.at}' HH:mm`

    const formattedStartDate = formatWithLocale(startDate, dateFormat, lang)
    const formattedEndDate = formatWithLocale(endDate, dateFormat, lang)

    return `${l.alert} *${event.title}* ${l.starts}\n\n${l.period}: ${formattedStartDate} ${l.until} ${formattedEndDate}\n${l.duration}: ${duration} ${l.days}`
}

async function main() {
    const bot = new Telegraf(config.telegram.botToken)

    const data = await fetchDitelp<AllEventsResponse>({
        path: "Dashboard/GetAllEvents",
        method: "POST"
    })

    const locBR = await fetchLocalization("br")
    const locEN = await fetchLocalization("en")
    const locES = await fetchLocalization("es")
    const ditlepLoc = await fetchLocalization(config.localization.ditlepLanguage)

    const allEvents = data.currentEvents.concat(data.upcomingEvents).map((event, index) => ({ ...event, index }))
    const todayEvents = filterTodayEvents(allEvents)

    const eventsBR = normalizeEvents(todayEvents, ditlepLoc, locBR)
    const eventsEN = normalizeEvents(todayEvents, ditlepLoc, locEN)
    const eventsES = normalizeEvents(todayEvents, ditlepLoc, locES)

    for (let i = 0; i < eventsBR.length; i++) {
        const eBR = eventsBR[i]
        const eEN = eventsEN[i]
        const eES = eventsES[i]

        const msgBR = createEventMessage(eBR, "br")
        const msgEN = createEventMessage(eEN, "en")
        const msgES = createEventMessage(eES, "es")

        const telegramMessages = [msgBR, msgEN, msgES]

        const shouldShowDonateButtons = Math.random() < 0.2

        for (const msg of telegramMessages) {
            await bot.telegram.sendMessage(config.telegram.updatesChannelId, msg, {
                parse_mode: "Markdown",
                reply_markup: shouldShowDonateButtons ? {
                    inline_keyboard: [
                        [
                            { text: "☕️ Doe via Buy me a Coffe", url: "https://buymeacoffee.com/marcuth" }
                        ],
                        [
                            { text: "❤️ Doe via Ko-fi", url: "https://ko-fi.com/marcuth" }
                        ],
                        [
                            { text: "💠 Doe via Livepix", url: "https://livepix.gg/marcuth" }
                        ]
                    ]
                } : undefined
            })
        }

        await sendDiscordMessage(
            config.discord.islandsWebhookUrl,
            [msgBR, msgEN, msgES],
            ["Novo Evento Iniciado!", "New Event Started!", "¡Nuevo Evento Iniciado!"],
            "<@&1472666734031929425>"
        )
    }
}

if (require.main === module) {
    main()
}