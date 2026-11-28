/**
 * Mode démo, `&volume=1` : quelques centaines de fiches fictives en plus de `FICHES_DEMO`, pour voir les vues (graphe,
 * arbre, recherche) dans les conditions d'un coffre réel. Tirage déterministe : les mêmes fiches à chaque chargement.
 * Noms d'entreprises et de personnes inventés.
 */

/** Fiches existantes de `FICHES_DEMO` auxquelles les fiches tirées se rattachent aussi. */
const ANCRES = [
	'projets/erp-saas/erp-saas',
	'projets/erp-saas/Module stocks',
	'projets/api-facturation/api-facturation',
	'projets/agent-maison/agent-maison',
	'clients/logistique-durand/logistique-durand',
	'stacks/Symfony',
	'stacks/PostgreSQL',
	'decisions/Choix de PostgreSQL',
	'personnes/Marc Lefèvre',
	'personnes/Claire Martin',
];

const ENTREPRISES = ['Atelier Vernier', 'Brasserie Kervalec', 'Cabinet Morand', 'Domaine des Aubiers', 'Éditions Lumen', 'Ferronnerie Duval', 'Groupe Hélios', 'Imprimerie Castel', 'Jardins de Saulx', 'Laboratoire Orphée', 'Menuiserie Brunet', 'Nova Transports', 'Optique Arnaud', 'Pépinières Valmy'];
const PROJETS = ['portail-clients', 'appli-terrain', 'site-boutique', 'gestion-planning', 'outil-devis', 'intranet-rh', 'tableau-de-bord', 'connecteur-compta', 'suivi-chantiers', 'catalogue-produits', 'prise-de-rdv', 'gestion-flotte', 'portail-fournisseurs', 'app-inventaire', 'crm-maison', 'billetterie', 'espace-adherents', 'kit-ui'];
const PRENOMS = ['Adèle', 'Bastien', 'Camille', 'Damien', 'Élodie', 'Fabien', 'Gaëlle', 'Hugo', 'Isabelle', 'Julien', 'Karine', 'Léon', 'Manon', 'Nicolas', 'Océane', 'Pierre', 'Quentin', 'Rose', 'Sacha', 'Thomas', 'Ulysse', 'Valérie', 'William', 'Yasmine', 'Zoé'];
const NOMS = ['Arnoux', 'Bellec', 'Chauvin', 'Delorme', 'Esnault', 'Fournel', 'Guérin', 'Hamon', 'Jacquet', 'Lemaire', 'Marchal', 'Noël', 'Perrin', 'Rigaud', 'Sauvage', 'Tessier', 'Vidal', 'Weber'];
const ROLES = ['directrice des opérations', 'chef de projet', 'responsable informatique', 'comptable', 'gérant', 'responsable qualité', 'développeuse', 'chargé de clientèle'];
const SUJETS_PROJET = ['Authentification', 'Droits d\'accès', 'Export PDF', 'Import des données', 'Notifications', 'Recherche', 'Tableau de bord', 'Facturation', 'Planning', 'Paiement en ligne', 'Mode hors ligne', 'Historique', 'Synchronisation', 'Traductions', 'Statistiques', 'Fiche client', 'Relances', 'Archivage', 'API publique', 'Performances'];
const DECISIONS = ['Choix de Redis pour le cache', 'Sauvegardes chiffrées chaque nuit', 'Une base par client', 'Pas de microservices', 'Tests de bout en bout sur la recette', 'Files de messages pour les exports', 'Authentification par lien magique', 'Hébergement chez un seul prestataire', 'Front en React', 'Migrations jouées au déploiement', 'Journal d\'audit sur les écritures', 'Version mobile en PWA', 'Dates stockées en UTC', 'Montants en centimes', 'Recherche plein texte native', 'Feature flags par client', 'Code revu avant fusion', 'Releases le mardi', 'Logs gardés 90 jours', 'Pas de dépendance non maintenue'];
const PRATIQUES = ['Nommer les tests', 'Écrire une migration', 'Relire une pull request', 'Découper une tâche', 'Rédiger un compte rendu', 'Estimer une charge', 'Préparer une recette', 'Gérer une régression', 'Documenter une API', 'Nommer les branches', 'Ranger les fichiers', 'Écrire un message d\'erreur', 'Choisir une dépendance', 'Mesurer une lenteur', 'Annoncer une mise en production'];
const STACKS = ['React', 'TypeScript', 'Redis', 'Docker', 'Twig', 'Vite', 'MariaDB', 'RabbitMQ'];
const SOURCES = ['Cahier des charges', 'Compte rendu de réunion', 'Devis signé', 'Mail du client', 'Spécification fonctionnelle', 'Note de cadrage', 'Retour de recette', 'Charte graphique'];
const EPISODES = ['Correction des droits', 'Refonte de la recherche', 'Mise à jour des dépendances', 'Nouvel export', 'Écran de connexion', 'Optimisation des requêtes', 'Recette avec le client', 'Préparation de la release', 'Migration des données', 'Ajout des notifications'];
const CATEGORIES = ['decision', 'perimetre', 'echeance', 'preference', 'contrainte', 'reference'];
const VERBES = ['concerne', 'utilise', 'depend_de', 'cite', 'precise', 'decide_pour'];

/** Générateur pseudo-aléatoire à graine (mulberry32). */
function tirage(graine: number): () => number {
	let a = graine;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function identifiant(n: number): string {
	let s = '';
	for (let i = 0, x = n; i < 8; i++, x = Math.floor(x / 32)) s = BASE32[x % 32]! + s;
	return `01JE9V0LUME0000000${s}`;
}

type Brouillon = { chemin: string; titre: string; type: string; synthese: string; liens: string[] };

/** Les fiches fictives, `chemin → contenu`, à fusionner avec `FICHES_DEMO`. */
export function fichesDeVolume(graine = 42): Record<string, string> {
	const hasard = tirage(graine);
	const un = <T,>(liste: readonly T[]): T => liste[Math.floor(hasard() * liste.length)]!;
	const brouillons: Brouillon[] = [];
	const ajouter = (b: Brouillon) => brouillons.push(b);

	const personnes: string[] = [];
	for (let i = 0; personnes.length < 60 && i < 400; i++) {
		const nom = `${un(PRENOMS)} ${un(NOMS)}`;
		if (!personnes.includes(nom)) personnes.push(nom);
	}

	const clients = ENTREPRISES.map((e) => `clients/${e}/${e}`);
	ENTREPRISES.forEach((e, i) => {
		ajouter({ chemin: clients[i]!, titre: e, type: 'dossier', synthese: `Client depuis ${2019 + (i % 6)}, ${10 + Math.floor(hasard() * 200)} salariés.`, liens: [] });
		for (const s of ['Contrat', 'Historique du compte', 'Interlocuteurs'].slice(0, 1 + Math.floor(hasard() * 3)))
			ajouter({ chemin: `clients/${e}/${s}`, titre: `${s} ${e}`, type: 'sujet', synthese: `${s} du client ${e}.`, liens: [clients[i]!] });
	});

	const projets = PROJETS.map((p) => `projets/${p}/${p}`);
	PROJETS.forEach((p, i) => {
		ajouter({ chemin: projets[i]!, titre: p, type: 'dossier', synthese: `Projet ${p} pour ${un(ENTREPRISES)}.`, liens: [un(clients)] });
		const nombre = 8 + Math.floor(hasard() * 8);
		const pris = new Set<string>();
		for (let k = 0; k < nombre; k++) {
			const s = un(SUJETS_PROJET);
			if (pris.has(s)) continue;
			pris.add(s);
			ajouter({ chemin: `projets/${p}/${s}`, titre: s, type: 'sujet', synthese: `${s} dans ${p} : périmètre, choix et points ouverts.`, liens: [projets[i]!] });
		}
	});

	personnes.forEach((n) => ajouter({ chemin: `personnes/${n}`, titre: n, type: 'entite', synthese: `${un(ROLES)} chez ${un(ENTREPRISES)}.`, liens: [un(clients), un(projets)] }));
	DECISIONS.forEach((d) => ajouter({ chemin: `decisions/${d}`, titre: d, type: 'sujet', synthese: `Décision prise après comparaison des options.`, liens: [un(projets)] }));
	PRATIQUES.forEach((d) => ajouter({ chemin: `pratiques/${d}`, titre: d, type: 'sujet', synthese: `Méthode suivie sur tous les projets.`, liens: [] }));
	STACKS.forEach((d) => ajouter({ chemin: `stacks/${d}`, titre: d, type: 'entite', synthese: `Conventions et pièges de ${d}.`, liens: [] }));
	for (let k = 0; k < 90; k++) {
		const p = un(PROJETS);
		ajouter({ chemin: `sources/${p}/${un(SOURCES)} ${k + 1}`, titre: `${un(SOURCES)} ${k + 1}`, type: 'source', synthese: `Document déposé pour ${p}.`, liens: [`projets/${p}/${p}`] });
	}
	for (let k = 0; k < 70; k++) {
		const p = un(PROJETS);
		const jour = String(1 + (k % 28)).padStart(2, '0');
		const titre = un(EPISODES);
		ajouter({ chemin: `episodes/${p}/2026-${k % 2 ? '10' : '11'}-${jour}-${titre}`, titre, type: 'episode', synthese: `Session sur ${p} : ${titre.toLowerCase()}.`, liens: [`projets/${p}/${p}`] });
	}

	// liens transverses : chaque fiche pointe vers une à trois autres, parfois vers les fiches de départ de la démo
	const chemins = brouillons.map((b) => b.chemin);
	for (const b of brouillons) {
		const n = Math.floor(hasard() * 3) + (b.type === 'dossier' ? 2 : 0);
		for (let k = 0; k < n; k++) b.liens.push(hasard() < 0.12 ? un(ANCRES) : un(chemins));
	}

	const fiches: Record<string, string> = {};
	brouillons.forEach((b, i) => {
		const liens = [...new Set(b.liens.filter((l) => l !== b.chemin))];
		const mois = 1 + (i % 11);
		const fait = `- [${un(CATEGORIES)}] ${b.synthese} | declare | src: utilisateur | appris 2026-${String(mois).padStart(2, '0')}-12 | confiance ${60 + Math.floor(hasard() * 40)} % ^f-0001`;
		fiches[`${b.chemin}.md`] = [
			'---',
			`id: ${identifiant(i)}`,
			`type: ${b.type}`,
			`updated: 2026-${String(mois).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`,
			'---',
			`# ${b.titre}`,
			'',
			b.synthese,
			'',
			'## Informations',
			fait,
			...(liens.length ? ['', '## Relations', ...liens.map((l) => `- ${un(VERBES)} [[${l}]]`)] : []),
			'',
		].join('\n');
	});
	return fiches;
}
