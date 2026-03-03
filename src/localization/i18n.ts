import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
    fallbackLng: "en",
    resources: {
        en: {
            translation: {
                title: "Home Page",
                description: "This is an example of translation in en",
            },
        },
        "ml-IND": {
            translation: {
                title: "ഹോം പേജ്",
                description: "മലയാളത്തിലെ വിവർത്തനത്തിൻ്റെ ഉദാഹരണമാണിത്",
            },
        },
    },
});
