# Composants tiers / Third-party components

Gamelle intègre les composants suivants, distribués sous leur propre licence. Ces licences s'appliquent à ces composants uniquement ; le reste du projet est sous la licence du fichier `LICENSE`.

*Gamelle includes the following components, each distributed under its own license. These licenses apply to those components only; the rest of the project is under the license in the `LICENSE` file.*

## supabase-js

Fichier : `vendor/supabase.js` (version 2.119.0), <https://github.com/supabase/supabase-js>

```
MIT License

Copyright (c) 2020 Supabase

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Police Archivo

Fichier : `fonts/archivo.woff2`, <https://github.com/Omnibus-Type/Archivo>

Distribuée sous la SIL Open Font License 1.1, dont le texte complet se trouve dans `fonts/LICENSE-Archivo.txt`.

## Table Ciqual (données nutritionnelles)

Fichier : `js/data/ingredients.js` (valeurs extraites pour une centaine d'ingrédients).

Source : « Anses. 2020. Table de composition nutritionnelle des aliments Ciqual », <https://ciqual.anses.fr>. L'Anses met ces données à disposition du public, à condition d'indiquer clairement la source. Les valeurs du skyr, de la whey, du lait de coco allégé, du cottage cheese et du fromage frais type Philadelphia ne figurent pas dans cette table : ce sont des moyennes d'étiquettes, signalées comme telles.

## Open Food Facts

Service : <https://world.openfoodfacts.org> et <https://search.openfoodfacts.org>

Quand tu ajoutes un aliment par son nom ou son code-barres, Gamelle interroge Open Food Facts depuis ton navigateur et recopie le nom et les valeurs nutritionnelles du produit choisi. Seul le texte cherché (ou le code-barres) est envoyé. Les données d'Open Food Facts sont publiées sous la licence Open Database License (ODbL) : <https://opendatacommons.org/licenses/odbl/1-0/>. La source (« Open Food Facts » et le code-barres) est enregistrée avec chaque aliment ajouté ainsi.
