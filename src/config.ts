import { env } from "./utils/env"

export const config = {
    telegram: {
        botToken: env("TELEGRAM_BOT_TOKEN"),
        updatesChannelId: env("TELEGRAM_UPDATES_CHANNEL_ID")
    },
    ditlep: {
        encryptionIv: env("DITLEP_ENCRYPTION_IV"),
        encryptionKey: env("DITLEP_ENCRYPTION_KEY")
    },
    localization: {
        language: "br",
        ditlepLanguage: "en"
    },
    discord: {
        allianceChestsWebhookUrl: env("ALLIANCE_CHESTS_WEBHOOK_URL"),
        islandsWebhookUrl: env("ISLANDS_WEBHOOK_URL"),
    }
}