import { ptBR, enUS, es } from "date-fns/locale"
import { format } from "date-fns"

export function formatWithLocale(date: Date, formatStr: string, lang: "br" | "en" | "es") {
    const locales = {
        br: ptBR,
        en: enUS,
        es: es
    }

    return format(date, formatStr, {
        locale: locales[lang] || ptBR
    })
}
