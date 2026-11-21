# Plánovač zateplení

Webová aplikace pro koncové zákazníky. Zákazník zadá konstrukce a rozměry a dostane doporučený produkt, jeho tloušťku, ověření hodnoty U a přesný nákupní seznam v baleních.

## Spuštění
Stačí otevřít `index.html` v prohlížeči. Aplikace nemá build krok ani závislosti a dá se nasadit na libovolný statický hosting (třeba GitHub Pages).

## Co umí
- **6 typů konstrukcí:** šikmá střecha (mezi a pod krokve), strop pod půdou (pochozí i nepochozí), kontaktní fasáda ETICS, provětrávaná fasáda, stěna dřevostavby a akustická příčka.
- **3 úrovně cíle** podle ČSN 73 0540-2: požadovaná, doporučená a pasivní.
- **3 priority:** nejtenčí vrstva, vyvážené řešení, nejnižší cena.
- **Výpočet U** podle principu ČSN EN ISO 6946, u dřevěných prvků (krokve, sloupky) jako průměr horní a dolní meze.
- **Výběr tloušťky:** dutinu vyplní kombinací nejvýše dvou dostupných tlouštěk. Když to nestačí, přidá doplňkovou vrstvu, ale jen do limitu, který zákazník zadá. Pokud ani pak cíl nesplní, aplikace na to upozorní.
- **Nákupní seznam:** izolace a parotěsné příslušenství, s prořezem a zaokrouhlením na celá balení. Jde zkopírovat nebo vytisknout do PDF.
- **Ukládání:** projekt se ukládá v prohlížeči. Aplikace funguje i na mobilu a podporuje tmavý režim.

## ⚠️ Před ostrým nasazením
Hodnoty v souboru `js/catalog.js` jsou **orientační**: λD, dostupné tloušťky a hlavně obsah balení (`packM2`). Nahraďte je daty z aktuálních technických listů a ceníku. Pak nastavte `DATA_VERIFIED = true`, tím zmizí žlutý pruh s upozorněním. Ve stejném souboru se nastavuje také `BRAND.contactUrl`, tedy odkaz tlačítka „Poptat u prodejce“.

## Struktura
- `js/catalog.js` – produkty, normové hodnoty a typy konstrukcí (jediné místo pro správu dat)
- `js/calc.js` – výpočetní jádro (čisté funkce)
- `js/app.js` – uživatelské rozhraní
- `tests/calc.test.js` – testy (`node tests/calc.test.js`)
