import axios from "axios"

export async function sendDiscordMessage(webhookUrl: string | undefined, messages: string | string[], titles?: string | string[], mention?: string) {
    if (!webhookUrl) return

    const messagesArray = Array.isArray(messages) ? messages : [messages]
    const titlesArray = Array.isArray(titles) ? titles : new Array(messagesArray.length).fill(titles || "Novo Alerta")

    const embeds = messagesArray.map((content, i) => ({
        title: titlesArray[i] || titlesArray[0] || "Novo Alerta",
        description: content,
        timestamp: new Date().toISOString(),
        color: 5814783
    }))

    const shouldSendDonation = Math.random() < 0.2

    if (shouldSendDonation) {
        embeds.push({
            title: "☕️ Support the Project / Apoie o Projeto",
            description: "If you find this bot helpful, please consider making a donation to help keep it running and up to date!\n\n" +
                "🔹 **Buy me a Coffee:** [Click Here](https://buymeacoffee.com/marcuth)\n" +
                "🔹 **Ko-fi:** [Click Here](https://ko-fi.com/marcuth)\n" +
                "🔹 **Livepix (PIX):** [Click Here](https://livepix.gg/marcuth)\n\n" +
                "*Thank you for your support!*",
            timestamp: new Date().toISOString(),
            color: 16776960
        })
    }

    const payload: any = {
        username: "DC Mapas Updates",
        embeds: embeds,
        content: mention || undefined
    }

    try {
        await axios.post(webhookUrl, payload)
    } catch (error: any) {
        console.error("Erro ao enviar para o Discord via Axios:", error.response?.data || error.message)
    }
}
