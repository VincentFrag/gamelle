# Gamelle : repas, courses et budget de la semaine

Application web installable (PWA) pour téléphone, tablette et ordinateur, petite sœur de [Fonte](https://github.com/VincentFrag/fonte). Elle permet de :

- **planifier la semaine** : midi et soir, plus un petit-déjeuner ou une collation les jours où on en prend. Le plat du soir est prévu en 2 portions, et l'app **propose** de garder la seconde pour la **gamelle du lendemain midi** (rien n'est ajouté sans accord) ;
- **se faire proposer des repas** selon son objectif, son temps de cuisine et son matériel (plaques, four, micro-ondes, Monsieur Cuisine), avec au plus une **version maison** d'un plat qu'on commande par semaine, et pas toutes les semaines ;
- **composer une assiette** simple (féculent, protéine, légume, **sauce légère**), ajouter un **dessert** à un repas, ou prévoir un **gâteau de la semaine** mangé en parts ;
- cocher **ce qu'on a** au frigo, au congélateur et au placard, et voir **ce qu'on peut cuisiner avec** ;
- suivre les **calories et les macros** (protéines, glucides, lipides) par repas et par jour, face à un objectif calculé ;
- connaître le **prix** de chaque repas, de la journée, de la semaine et du mois, et l'**argent économisé** par rapport aux commandes en livraison ;
- obtenir la **liste de courses**, groupée par rayon et arrondie aux conditionnements du commerce, en retirant ce qu'on a déjà en **réserve**, avec les **fonds de placard** à racheter chaque semaine ou chaque mois ;
- suivre les **recettes** pas à pas en **mode cuisine** (écran allumé, minuteurs) ;
- noter son **poids** à la main, avec une courbe de tendance. Les pesées de Gamelle restent dans Gamelle : rien n'est partagé avec Fonte.

L'app contient une trentaine de plats (dont des versions maison de plats qu'on commande : burger, tikka masala, poke bowl, pizza…), 6 sauces légères, 11 desserts simples, 6 gâteaux et desserts de la semaine, des petits-déjeuners et des collations. On peut ajouter ses propres recettes et ingrédients.

---

## Installation

Tu as besoin d'un compte [GitHub](https://github.com) et d'un projet [Supabase](https://supabase.com). Si Fonte est déjà en place, Gamelle s'installe dans le **même projet Supabase** : même compte, mais des données séparées, et pas de deuxième projet à créer.

### 1. Mettre les fichiers sur GitHub

1. Sur GitHub, clique sur **+** puis **New repository**. Nom : `gamelle`, visibilité **Public**, puis **Create repository**.
2. Sur la page du dépôt vide, clique sur **uploading an existing file**.
3. Glisse **le contenu** du dossier `gamelle` (les dossiers `css`, `js`, `icons`… et les fichiers `index.html`, `sw.js`…), pas le dossier lui-même. Puis **Commit changes**.

### 2. Mettre le site en ligne

1. Dans le dépôt, **Settings > Pages**.
2. Source : **Deploy from a branch** ; Branch : **main**, dossier **/ (root)**, puis **Save**.
3. Une à deux minutes plus tard, l'app est en ligne à l'adresse `https://TON-PSEUDO.github.io/gamelle/`.

### 3. Préparer la base de données

1. Dans Supabase, ouvre le projet de Fonte, puis **SQL Editor > New query**.
2. Colle tout le contenu de `supabase/schema.sql` et clique sur **Run**.
3. Le résultat doit afficher 1 ligne (`gamelle`) avec `rls_active = true`.

Le script ne touche à aucune table de Fonte. Il ajoute seulement une table `gamelle`.

### 4. Vérifier `config.js`

Le fichier contient l'adresse du projet et la clé **publique** (Project Settings > API Keys > *Publishable key*). Ce sont les mêmes que dans le `config.js` de Fonte. Ne mets jamais la clé *secret* ou *service_role*.

### 5. Se connecter et installer

1. Ouvre l'adresse de l'app, va dans **Plus > Compte et synchronisation** et connecte-toi avec ton compte Fonte.
2. Sur iPhone : dans Safari, bouton **Partager > Sur l'écran d'accueil**. Sur Android : menu du navigateur **> Installer l'application**.

### Mettre à jour

Remplace les fichiers modifiés sur GitHub (**Add file > Upload files**). À chaque nouvelle version, le numéro dans `sw.js` (`VERSION`) et dans `js/app.js` (`APP_VERSION`) doit changer : c'est ce qui déclenche la mise à jour sur les appareils.

---

## Premiers pas

1. **Plus > Profil et objectif** : sexe, âge, taille, activité et objectif. L'app en déduit les calories et protéines du jour.
2. **Plus > Préférences des menus** : temps de cuisine en semaine, versions maison par semaine, matériel, aliments à éviter, et ton rythme de commandes d'avant (panier moyen et nombre par semaine) pour le compteur d'économies.
3. **Semaine > Proposer la semaine**. Les midis qui suivent un plat du soir affichent « Gamelle proposée » : **Garder** l'ajoute, **Tout garder** les ajoute toutes. Touche un repas pour le changer, composer une assiette, ajouter un dessert, le remplacer par une commande ou un repas libre, ou ouvrir la recette.
4. **Courses > Ce que j'ai** : coche ce qu'il y a à la maison. **Qu'est-ce que je cuisine ?** propose des recettes et une assiette avec.
5. **Courses** : coche en rayon. En rentrant, **Ranger les articles cochés** met tout en réserve : le reste d'un paquet sera déduit des listes suivantes.
6. Le soir, **Cuisiner** ouvre le mode pas à pas. À la fin, le plat est marqué « cuisiné » et ses ingrédients sortent des réserves.

---

## Comment sont faits les calculs

- **Nutrition** : valeurs de la table Ciqual 2020 de l'Anses pour les ingrédients crus, sauf le skyr, la whey, le lait de coco allégé et le fromage frais type Philadelphia (moyennes d'étiquettes). Ce sont des ordres de grandeur.
- **Objectif** : métabolisme de base (formule de Mifflin-St Jeor) multiplié par le niveau d'activité, puis déficit ou surplus selon l'objectif. Protéines en g par kg de poids (1,8 par défaut), lipides à 28 % des calories, le reste en glucides.
- **Prix** : estimations moyennes en grande surface en France, modifiables dans **Plus > Prix des ingrédients**. Un repas coûte ce qu'on en mange ; la liste de courses arrondit aux paquets.
- **Économies** : sur les jours passés où des repas sont notés, chaque commande évitée par rapport à ton rythme d'avant compte pour la différence entre le panier moyen et le prix moyen d'un repas maison. Le compteur ne descend pas sous 0 €.

Gamelle donne des estimations et ne remplace pas l'avis d'un médecin ou d'un diététicien.

---

## Organisation du code

Pas de dépendance ni d'étape de compilation : du HTML, du CSS et des modules JavaScript.

| Fichier | Rôle |
| --- | --- |
| `js/data/ingredients.js` | Ingrédients : valeurs nutritionnelles, prix, conditionnements |
| `js/data/recipes.js` | Recettes de base (avec variantes Monsieur Cuisine) |
| `js/food.js` | Ingrédients et recettes fusionnés avec ceux de l'utilisateur, calculs par portion |
| `js/plan.js` | Planning, gamelle du lendemain, générateur de semaine, économies |
| `js/shop.js` | Liste de courses et réserves |
| `js/store.js`, `js/sync.js` | Stockage sur l'appareil et synchronisation Supabase |
| `js/views/` | Écrans |

## Licence

[PolyForm Noncommercial 1.0.0](LICENSE) : utilisation et modification libres, sans usage commercial. Composants et données tiers : voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
