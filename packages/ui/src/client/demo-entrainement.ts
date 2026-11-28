/**
 * Entraînement de la note de confiance en démonstration (`?demo`, Mémoire › Entraîner) : un banc fictif de 6 messages (2
 * validés, 2 pré-jugés par Claude à relire, 2 à juger), une note apprise refusée, un modèle d'avant (la note de départ) et
 * deux lignes d'historique. Toutes les routes `entrainement…` répondent comme le service : préparer, pré-juger et apprendre
 * lancent une tâche qui progresse (diffusée par `{ type: 'entrainement' }`), arrêtable ; apprendre finit sur un verdict
 * refusé crédible ; revenir échange les modèles ; message, annuler et « Accepter les sûres » tiennent le banc. Messages et
 * fiches fictifs. `&entrainement=vide` : rien de préparé, note de départ ; `sansjuge` : Claude Code introuvable ;
 * `volume` : volume atteint, la qualité décide (bandeau « Vers les vrais résultats » à 100 %, coche verte) ; `accepte` : le
 * dernier apprentissage accepté aux deux niveaux, modèle en service (verdicts en anglais quand l'interface l'est, pour les captures).
 */
import {
	ROUTES,
	type AvancementNoteVue,
	type CandidateAJugerVue,
	type EtatNoteVue,
	type JugementVue,
	type LigneHistoriqueVue,
	type MessageServeur,
	type NoteDuNiveauVue,
	type PropositionDuJugeVue,
	type ReponseAccepterSures,
	type ReponseAnnulation,
	type ReponseMessageAJuger,
	type ReponseReponseMessage,
	type ResultatApprentissageVue,
	type TacheEntrainementVue,
	type VueEntrainement,
} from '@mnemo/contrat';
import { ErreurApi } from './api.ts';

/** Départs de `&entrainement=`. */
export type DepartEntrainementDemo = 'vide' | 'sansjuge' | 'volume' | 'accepte';

const JOUR = 86_400_000;
/** Cadence des fausses tâches : un message préparé, un message pré-jugé, la durée d'un apprentissage. */
const PREPARER_MS = 280;
const PREJUGER_MS = 650;
const APPRENDRE_MS = 2600;
const SEUIL_SUR = 0.9;

type Candidate = Pick<CandidateAJugerVue, 'chemin' | 'titre' | 'ligne' | 'synthese'>;
type Cas = {
	message: string;
	precedent: string | null;
	candidates: Candidate[];
	propositions: Record<string, PropositionDuJugeVue> | null;
	jugements: Record<string, JugementVue>;
	valide: boolean;
	/** Date de validation (ISO) : les messages validés après le dernier apprentissage sont nouveaux. */
	valideLe?: string;
	silence: boolean;
	saute: boolean;
};

const fiche = (chemin: string, ligne: string, synthese: string): Candidate => ({ chemin, titre: chemin.split('/').pop()!.replace(/\.md$/, ''), ligne, synthese });

const EXPORT_CSV = fiche('projets/erp-saas/Export CSV.md', 'Séparateur point-virgule, encodage UTF-8 avec BOM.', 'Les exports CSV de l’ERP : séparateur, encodage, colonnes communes.');
const STOCKS = fiche('projets/erp-saas/Module stocks.md', 'Les mouvements de stock sont historisés par lot.', 'Le module stocks : mouvements, lots, inventaires.');
const COMMANDES = fiche('projets/erp-saas/achats/Commandes fournisseurs.md', 'Une commande validée ne se modifie plus.', 'Cycle de vie des commandes fournisseurs.');
const MAINTENANCE = fiche('clients/logistique-durand/Contrat de maintenance.md', 'Intervention sous 4 h ouvrées.', 'Le contrat de maintenance du client Logistique Durand.');
const VENDREDI = fiche('consignes/Pas de mise en production le vendredi.md', 'Aucune mise en production le vendredi après 12 h.', 'Consigne de mise en production.');
const ERP = fiche('projets/erp-saas/erp-saas.md', 'ERP en SaaS, Symfony et PostgreSQL.', 'Le projet ERP SaaS : périmètre, équipe, pile.');
const MULTI = fiche('projets/erp-saas/Multi-tenant.md', 'Un schéma PostgreSQL par client.', 'Isolation des clients dans l’ERP.');
const POSTGRES = fiche('stacks/PostgreSQL.md', 'Version 17 en production.', 'Pratiques PostgreSQL de l’équipe.');
const SYMFONY = fiche('stacks/Symfony.md', 'Symfony 7.3, contrôleurs fins.', 'Pratiques Symfony de l’équipe.');
const SFTP = fiche('projets/api-facturation/Dépôt SFTP.md', 'Dépôt chaque nuit à 2 h.', 'Le dépôt des factures par SFTP.');
const TEST = fiche('consignes/Test avant correction.md', 'Écrire le test qui échoue avant de corriger.', 'Consigne de correction des bugs.');
const FACTURATION = fiche('projets/api-facturation/api-facturation.md', 'API de facturation, arrondis au centime.', 'Le projet API de facturation.');
const COMMITS = fiche('consignes/Commits en français.md', 'Messages de commit en français.', 'Consigne de rédaction des commits.');
const MARC = fiche('personnes/Marc Lefèvre.md', 'Chef de projet côté client.', 'Contact du projet ERP.');
const MIGRATIONS = fiche('consignes/Migrations réversibles.md', 'Chaque migration a sa méthode down.', 'Consigne des migrations de base.');
const LOTS = fiche('episodes/erp-saas/2026-11-21-schema-des-lots.md', 'Schéma des lots arrêté le 21/11.', 'Session du 21/11 sur le schéma des lots.');
const ARCHI = fiche('projets/agent-maison/Architecture.md', 'Un agent par dossier.', 'Architecture de l’agent maison.');
const CLAIRE = fiche('personnes/Claire Martin.md', 'Développeuse front, kit UI.', 'Contact du kit UI.');

const nouveau = (message: string, candidates: Candidate[], precedent: string | null = null): Cas => ({ message, precedent, candidates, propositions: null, jugements: {}, valide: false, silence: false, saute: false });
const propose = (jugement: JugementVue, confiance: number, raison: string): PropositionDuJugeVue => ({ jugement, confiance, raison });

/** Le banc de départ : 2 validés (le `valideLe` donné, avant le dernier apprentissage), 2 pré-jugés à relire (l'un sûr, l'autre non), 2 à juger. */
function bancDeDepart(valideLe: string): Cas[] {
	return [
		{
			...nouveau('Ajoute l’export CSV des mouvements de stock, avec le même séparateur que l’export des commandes.', [EXPORT_CSV, STOCKS, COMMANDES, MAINTENANCE]),
			jugements: { [EXPORT_CSV.chemin]: 'pertinente', [STOCKS.chemin]: 'pertinente', [COMMANDES.chemin]: 'non_pertinente', [MAINTENANCE.chemin]: 'non_pertinente' },
			valide: true,
			valideLe,
		},
		{
			...nouveau('Le client veut décaler la mise en production à vendredi soir, on fait comment ?', [VENDREDI, MAINTENANCE, ERP]),
			jugements: { [VENDREDI.chemin]: 'pertinente', [MAINTENANCE.chemin]: 'indecise', [ERP.chemin]: 'non_pertinente' },
			valide: true,
			valideLe,
		},
		{
			...nouveau('oui, vas-y', [MULTI, POSTGRES, SYMFONY], 'On part sur un schéma PostgreSQL par client pour le multi-tenant ?'),
			propositions: {
				[MULTI.chemin]: propose('pertinente', 0.96, 'La fiche décrit exactement ce choix d’isolation.'),
				[POSTGRES.chemin]: propose('pertinente', 0.92, 'La version en production compte pour les schémas.'),
				[SYMFONY.chemin]: propose('non_pertinente', 0.94, 'Rien sur le multi-tenant.'),
			},
		},
		{
			...nouveau('Corrige le bug d’arrondi sur les factures déposées en SFTP.', [SFTP, TEST, FACTURATION]),
			propositions: {
				[SFTP.chemin]: propose('pertinente', 0.71, 'Le dépôt est concerné, mais l’arrondi se calcule avant.'),
				[TEST.chemin]: propose('pertinente', 0.93, 'La consigne s’applique à toute correction.'),
				[FACTURATION.chemin]: propose('pertinente', 0.88, 'La règle d’arrondi y est écrite.'),
			},
		},
		nouveau('Merci, c’est parfait.', [COMMITS, MARC]),
		nouveau('Écris la migration de la table des lots, réversible bien sûr.', [MIGRATIONS, LOTS, STOCKS]),
	];
}

/** `nombre` messages validés (le `valideLe` donné), tirés du faux journal, la première fiche jugée utile, les autres non. */
function bancValide(nombre: number, valideLe: string): Cas[] {
	const modeles = journalRestant();
	return Array.from({ length: nombre }, (_, i) => {
		const m = modeles[i % modeles.length]!;
		const jugements = Object.fromEntries(m.candidates.map((c, k) => [c.chemin, k === 0 ? 'pertinente' : 'non_pertinente'])) as Record<string, JugementVue>;
		return { ...m, jugements, valide: true, valideLe };
	});
}

/** Ce qui reste dans le faux journal des sessions, pour « Préparer » ; épuisé, la préparation échoue comme au service. */
function journalRestant(): Cas[] {
	return [
		nouveau('Ajoute un filtre par entrepôt sur l’inventaire.', [STOCKS, ERP]),
		nouveau('Qui valide les maquettes du kit UI côté client ?', [CLAIRE, MARC]),
		nouveau('Relance le dépôt SFTP de cette nuit, il a échoué.', [SFTP, FACTURATION, MAINTENANCE]),
		nouveau('On garde un agent par dossier ou on mutualise ?', [ARCHI]),
		nouveau('Fais le commit.', [COMMITS, TEST]),
		nouveau('Ajoute la colonne « lot » à l’export des stocks.', [EXPORT_CSV, STOCKS, LOTS]),
		nouveau('Peut-on livrer jeudi en fin de journée ?', [VENDREDI, MAINTENANCE]),
		nouveau('Prépare le schéma de la table des inventaires.', [MIGRATIONS, STOCKS, POSTGRES]),
	];
}

const VERDICTS: Record<EtatNoteVue, string> = {
	accepte: 'Accepté : les % sont justes et Mnemo injecte seul au-dessus de 90 %',
	coupe: 'Accepté, mais injection automatique coupée : trop de fiches injectées par Mnemo ont été écartées',
	refuse: 'Refusé : la note ordonne le classement, sans %',
	depart: 'Note de départ, à entraîner : elle ordonne le classement, sans %',
	non_appris: "Pas encore entraînée : le classement suit l'ordre de la recherche, sans %",
};

const DEPART: NoteDuNiveauVue[] = (['complets', 'sens'] as const).map((niveau) => ({
	niveau,
	etat: 'depart',
	origine: 'depart',
	date: '2026-11-25T18:00:00.000Z',
	seuil: null,
	verdict: VERDICTS.depart,
	criteres: ['note de départ livrée avec Mnemo, pas encore entraînée sur les jugements'],
	refus: ['note de départ, à entraîner'],
}));

/** Un apprentissage refusé, crédible pour un petit banc : trop peu de fiches au-dessus de 90 % et de messages silence. */
function apprentissageRefuse(date: string, messages: number, sessions: number, paires: number): { note: NoteDuNiveauVue[]; resultat: ResultatApprentissageVue } {
	const complets = {
		refus: ['2 injections simulées (au moins 25)', 'pas assez de messages silence : 1 de 1 sessions réelles (au moins 5 de 3)'],
		criteres: ['trop peu de fiches que Mnemo injecterait (note au-dessus de 90 %) : 2, il en faut 25', "trop peu de messages « Rien d'utile ici » : 1 venu de 1 session, il en faut 5 venus de 3"],
	};
	const sens = { refus: ['précision - (au moins 0.85)'], criteres: ['aucune fiche au-dessus de 90 % pour mesurer si les % sont justes'] };
	const fiabilite = (decalage: number) =>
		[
			[0, 0.2, 0.08, 0.05],
			[0.2, 0.4, 0.31, 0.27],
			[0.4, 0.6, 0.5, 0.58],
			[0.6, 0.8, 0.69, 0.63],
			[0.8, 1, 0.86, 0.79],
		].map(([de, a, pMoyen, frequence], i) => ({ de: de!, a: a!, paires: Math.max(0, Math.round(paires * [0.34, 0.22, 0.18, 0.16, 0.1][i]!) - decalage), pMoyen: pMoyen!, frequence: frequence! }));
	return {
		note: [
			{ niveau: 'complets', etat: 'refuse', origine: 'appris', date, seuil: 0.9, verdict: VERDICTS.refuse, ...complets },
			{ niveau: 'sens', etat: 'refuse', origine: 'appris', date, seuil: 0.9, verdict: VERDICTS.refuse, ...sens },
		],
		resultat: {
			date,
			remplace: true,
			messages,
			sessions,
			niveaux: [
				{ niveau: 'complets', accepte: false, verdict: VERDICTS.refuse, ...complets, paires, fiabilite: fiabilite(0) },
				{ niveau: 'sens', accepte: false, verdict: VERDICTS.refuse, ...sens, paires, fiabilite: fiabilite(1) },
			],
		},
	};
}

/**
 * Un apprentissage accepté aux deux niveaux, sur un banc assez fourni : les % suivent ce qui est réellement utile (table de
 * fiabilité calibrée). `anglais` : verdict en anglais, comme les captures du site en anglais.
 */
function apprentissageAccepte(date: string, anglais: boolean): { note: NoteDuNiveauVue[]; resultat: ResultatApprentissageVue } {
	const verdict = anglais ? 'Accepted: the percentages are right and Mnemo injects on its own above 90%' : VERDICTS.accepte;
	const fiabilite = (paires: number) =>
		[
			[0, 0.2, 0.09, 0.07],
			[0.2, 0.4, 0.3, 0.28],
			[0.4, 0.6, 0.51, 0.49],
			[0.6, 0.8, 0.7, 0.73],
			[0.8, 1, 0.92, 0.9],
		].map(([de, a, pMoyen, frequence], i) => ({ de: de!, a: a!, paires: Math.round(paires * [0.31, 0.2, 0.14, 0.13, 0.22][i]!), pMoyen: pMoyen!, frequence: frequence! }));
	const niveaux = (['complets', 'sens'] as const).map((niveau) => ({ niveau, paires: niveau === 'complets' ? 142 : 118 }));
	return {
		note: niveaux.map(({ niveau }) => ({ niveau, etat: 'accepte' as const, origine: 'appris' as const, date, seuil: 0.9, verdict, criteres: [], refus: [] })),
		resultat: {
			date,
			remplace: true,
			messages: 64,
			sessions: 12,
			niveaux: niveaux.map(({ niveau, paires }) => ({ niveau, accepte: true, verdict, criteres: [], refus: [], paires, fiabilite: fiabilite(paires) })),
		},
	};
}

export function creerEntrainementDemo(diffuser: (m: MessageServeur) => void, depart?: DepartEntrainementDemo, anglais = false) {
	const vide = depart === 'vide';
	const avantHier = new Date(Date.now() - 2 * JOUR).toISOString();
	let banc: Cas[] = vide ? [] : bancDeDepart(new Date(Date.now() - 3 * JOUR).toISOString());
	// modèle accepté : le banc qui l'a permis, 62 messages validés de plus avant l'apprentissage (64 en tout, comme le rapport)
	if (depart === 'accepte') banc = [...bancValide(62, new Date(Date.now() - 3 * JOUR).toISOString()), ...banc];
	let journal = journalRestant();
	const hier = new Date(Date.now() - JOUR).toISOString();
	const appris = depart === 'accepte' ? apprentissageAccepte(hier, anglais) : apprentissageRefuse(avantHier, 2, 2, 6);
	let note: NoteDuNiveauVue[] = vide ? structuredClone(DEPART) : appris.note;
	let avant: NoteDuNiveauVue[] | null = vide ? null : structuredClone(DEPART);
	let resultat: ResultatApprentissageVue | null = vide ? null : appris.resultat;
	let historique: LigneHistoriqueVue[] = vide
		? []
		: depart === 'accepte'
			? [
					{ date: hier, origine: 'manuel', verdicts: { complets: 'accepte', sens: 'accepte' }, remplace: true },
					{ date: new Date(Date.now() - 4 * JOUR).toISOString(), origine: 'automatique', verdicts: { complets: 'refuse', sens: 'refuse' }, remplace: false },
					{ date: new Date(Date.now() - 6 * JOUR).toISOString(), origine: 'manuel', verdicts: { complets: 'refuse', sens: 'refuse' }, remplace: true },
				]
			: [
				{
					date: new Date(Date.now() - JOUR).toISOString(),
					origine: 'automatique',
					verdicts: { complets: 'refuse', sens: 'refuse' },
					remplace: false,
					erreur: 'Le reranker local n’a pas répondu : les modèles ont été arrêtés pendant l’essai.',
				},
				{ date: avantHier, origine: 'manuel', verdicts: { complets: 'refuse', sens: 'refuse' }, remplace: true },
			];
	const juge: VueEntrainement['juge'] =
		depart === 'sansjuge' ? { disponible: false, raison: 'Claude Code introuvable (commande claude absente du PATH, ou MNEMO_CLAUDE) : le pré-jugement par Claude n’est pas disponible.' } : { disponible: true };
	let tache: TacheEntrainementVue | null = null;
	let minuteur: ReturnType<typeof setTimeout> | null = null;
	let derniereErreur: string | undefined;
	/** Annulations : les messages tels qu'ils étaient avant chaque réponse (ou « Accepter les sûres »). */
	const annulations: { indice: number; cas: Cas }[][] = [];

	// comme le service : un message répondu (validé ou « Rien d'utile ici ») ou passé n'est plus à juger
	const aJuger = (c: Cas) => !c.valide && !c.silence && !c.saute;
	const aRelire = (c: Cas) => aJuger(c) && c.propositions !== null;
	const paires = (c: Cas) => (c.valide ? Object.values(c.jugements).filter((j) => j !== 'indecise').length : 0);
	/** Comme le service : le plus récent des essais réussis de l'historique et des dates des notes apprises ; null : jamais appris. */
	const dernierApprentissage = (): string | null => {
		const dates = [...historique.filter((l) => l.erreur === undefined).map((l) => l.date), ...note.flatMap((n) => (n.origine === 'appris' && n.date !== null ? [n.date] : []))];
		return dates.reduce<string | null>((a, d) => (a === null || d > a ? d : a), null);
	};

	/** Comme le service : sans apprentissage, les messages « Rien d'utile ici » jugés ; sinon l'avancement crédible d'un petit banc. */
	const avancement = (): AvancementNoteVue | null => {
		// comme le service : un modèle accepté n'a plus d'avancement à montrer
		if (depart === 'accepte') return null;
		if (depart === 'volume') {
			return {
				part: 1,
				niveau: 'complets',
				parNiveau: [
					{ niveau: 'complets', part: 1 },
					{ niveau: 'sens', part: 0.64 },
				],
				volumes: [
					{ nom: 'injections', fait: 31, cible: 25 },
					{ nom: 'sessions', fait: 12, cible: 10 },
					{ nom: 'silences', fait: 24, cible: 20, sessions: { fait: 9, cible: 5 } },
				],
				qualite: 'les fiches que Mnemo injecterait ne sont utiles que 72 % du temps (non jugées comptées inutiles), il en faut 80 %',
				ecart: { points: 12, depuis: new Date(Date.now() - 3 * JOUR).toISOString() },
				seuil: 0.8,
			};
		}
		if (resultat === null) return { part: null, niveau: null, parNiveau: [], volumes: [{ nom: 'silences', fait: banc.filter((c) => c.silence).length, cible: 20 }], qualite: null, ecart: null, seuil: null };
		return {
			part: 0.08,
			niveau: 'complets',
			parNiveau: [
				{ niveau: 'complets', part: 0.08 },
				{ niveau: 'sens', part: 0 },
			],
			volumes: [
				{ nom: 'injections', fait: 2, cible: 25 },
				{ nom: 'sessions', fait: 2, cible: 10 },
				{ nom: 'silences', fait: 16, cible: 20, sessions: { fait: 11, cible: 5 } },
			],
			qualite: null,
			ecart: { points: 3, depuis: new Date(Date.now() - 3 * JOUR).toISOString() },
			seuil: 0.9,
		};
	};

	function vue(): VueEntrainement {
		const presents = banc.filter((c) => !c.saute);
		const depuis = dernierApprentissage();
		return {
			note: { niveaux: structuredClone(note), avant: avant !== null },
			avancement: avancement(),
			banc: {
				messages: presents.length,
				valides: presents.filter((c) => c.valide).length,
				aJuger: banc.filter(aJuger).length,
				aRelire: banc.filter(aRelire).length,
				aPrejuger: banc.filter((c) => aJuger(c) && c.propositions === null).length,
				silences: banc.filter((c) => c.silence).length,
				sautes: banc.filter((c) => c.saute).length,
				paires: banc.reduce((n, c) => n + paires(c), 0),
				nouveauxDepuisApprentissage: presents.filter((c) => c.valide && (depuis === null || (c.valideLe !== undefined && c.valideLe > depuis))).length,
			},
			tache: tache === null ? null : { ...tache },
			historique: structuredClone(historique),
			juge,
			resultat: structuredClone(resultat),
			...(derniereErreur === undefined ? {} : { derniereErreur }),
		};
	}
	const changer = () => diffuser({ type: 'entrainement', etat: vue() });

	const NOMS = { preparer: 'préparer des messages', prejuger: 'pré-juger avec Claude', apprendre: 'apprendre la note' } as const;
	/** Lance une fausse tâche : `pas` fait avancer d'un cran et rend faux quand elle est finie. */
	function lancer(genre: TacheEntrainementVue['genre'], total: number, delai: number, pas: (fait: number) => boolean): VueEntrainement {
		if (tache !== null) throw new ErreurApi(`Une tâche est déjà en cours (${NOMS[tache.genre]}) : attendre sa fin ou l’arrêter.`, 409);
		derniereErreur = undefined;
		tache = { genre, fait: 0, total, depuis: new Date().toISOString() };
		const suivant = () => {
			minuteur = setTimeout(() => {
				if (tache === null) return;
				const encore = pas(tache.fait);
				tache = encore ? { ...tache, fait: tache.fait + 1 } : null;
				if (encore) suivant();
				else minuteur = null;
				changer();
			}, delai);
		};
		suivant();
		changer();
		return vue();
	}

	function preparer(corps: Record<string, unknown>): VueEntrainement {
		const nombre = corps['nombre'] ?? 30;
		if (typeof nombre !== 'number' || !Number.isInteger(nombre) || nombre < 1 || nombre > 200) throw new ErreurApi('Nombre de messages : de 1 à 200.', 400);
		const choisis = Math.min(nombre, journal.length);
		return lancer('preparer', choisis, PREPARER_MS, (fait) => {
			if (choisis === 0) {
				derniereErreur = "Aucun message nouveau dans le journal des sessions : utiliser Mnemo, puis en préparer d'autres.";
				return false;
			}
			banc = [...banc, journal.shift()!];
			return fait + 1 < choisis;
		});
	}

	function prejuger(): VueEntrainement {
		if (!juge.disponible) throw new ErreurApi(juge.raison ?? 'Claude Code introuvable.', 409);
		const cibles = banc.filter((c) => aJuger(c) && c.propositions === null);
		return lancer('prejuger', cibles.length, PREJUGER_MS, (fait) => {
			const c = cibles[fait];
			if (c === undefined) return false;
			// une confiance par fiche, sûre pour la première, plus hésitante ensuite
			c.propositions = Object.fromEntries(
				c.candidates.map((x, i) => [x.chemin, propose(i === 0 && !c.message.startsWith('Merci') ? 'pertinente' : 'non_pertinente', [0.95, 0.82, 0.91, 0.67][i % 4]!, `Proposition fictive pour « ${x.titre} ».`)]),
			);
			return fait + 1 < cibles.length;
		});
	}

	function apprendre(): VueEntrainement {
		if (banc.reduce((n, c) => n + paires(c), 0) === 0) throw new ErreurApi('Aucun jugement validé : juger des messages avant d’apprendre.', 409);
		return lancer('apprendre', 0, APPRENDRE_MS, () => {
			const date = new Date().toISOString();
			const valides = banc.filter((c) => c.valide);
			const appris = apprentissageRefuse(date, valides.length, Math.max(1, Math.ceil(valides.length / 2)), valides.reduce((n, c) => n + paires(c), 0));
			avant = note;
			note = appris.note;
			resultat = appris.resultat;
			historique = [{ date, origine: 'manuel' as const, verdicts: { complets: 'refuse' as const, sens: 'refuse' as const }, remplace: true }, ...historique].slice(0, 10);
			return false;
		});
	}

	function arreter(): VueEntrainement {
		// comme le service : 409 sans tâche (déjà finie, ou arrêtée ailleurs)
		if (tache === null) throw new ErreurApi('Aucune tâche en cours.', 409);
		if (minuteur !== null) clearTimeout(minuteur);
		minuteur = null;
		tache = null;
		changer();
		return vue();
	}

	function revenir(): VueEntrainement {
		if (tache?.genre === 'apprendre') throw new ErreurApi('Un apprentissage est en cours : attendre sa fin ou l’arrêter.', 409);
		if (avant === null) throw new ErreurApi("Aucun modèle d'avant.", 409);
		[note, avant] = [avant, note];
		changer();
		return vue();
	}

	const indiceValide = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
	const confianceMoyenne = (c: Cas) => {
		const p = Object.values(c.propositions ?? {});
		return p.length === 0 ? 1 : p.reduce((n, x) => n + x.confiance, 0) / p.length;
	};
	/** Le prochain à juger, comme le service : ceux à relire d'abord, les plus incertains en tête, puis les autres dans l'ordre. */
	const prochain = (): number | null => {
		const aRelireTries = banc
			.flatMap((c, indice) => (aRelire(c) ? [{ indice, confiance: confianceMoyenne(c) }] : []))
			.sort((a, b) => a.confiance - b.confiance || a.indice - b.indice);
		if (aRelireTries.length > 0) return aRelireTries[0]!.indice;
		const j = banc.findIndex(aJuger);
		return j >= 0 ? j : null;
	};

	function message(params: Record<string, string>): ReponseMessageAJuger {
		const brut = params['indice'];
		const i = brut !== undefined && brut !== '' ? Number(brut) : prochain();
		if (i !== null && !indiceValide(i)) throw new ErreurApi('Paramètre « indice » : un entier positif ou nul.', 400);
		if (i === null) return { message: null };
		const c = banc[i];
		if (c === undefined) throw new ErreurApi(`Message ${i} inconnu.`, 404);
		// ordre de présentation mêlé : stable pour un message
		const ordre = [...c.candidates].sort((a, b) => (a.chemin.length * (i + 3)) % 7 - (b.chemin.length * (i + 3)) % 7);
		return {
			message: {
				indice: i,
				message: c.message,
				precedent: c.precedent,
				candidates: ordre.map((x) => ({ ...x, proposition: c.propositions?.[x.chemin] ?? null, jugement: c.jugements[x.chemin] ?? null })),
				valide: c.valide,
				silence: c.silence,
				saute: c.saute,
				aRelire: aRelire(c),
				restants: banc.filter(aJuger).length,
			},
		};
	}

	/**
	 * Comme le service (`repondreMessage`) : les jugements d'un chemin qui n'est pas candidate sont ignorés ; « Rien d'utile
	 * ici » est refusé (409) si une fiche est jugée utile, déjà ou dans la réponse, et garde les fiches « Je ne sais pas » ;
	 * toute réponse qui ne passe pas valide le message (le reste « pas utile » si demandé) et le sort des passés.
	 */
	function repondre(corps: Record<string, unknown>): ReponseReponseMessage {
		const i = corps['indice'];
		if (!indiceValide(i)) throw new ErreurApi('Champ « indice » : un entier positif ou nul.', 400);
		if (corps['silence'] === true && corps['passer'] === true) throw new ErreurApi('« silence » et « passer » ne vont pas ensemble.', 400);
		const c = banc[i];
		if (c === undefined) throw new ErreurApi(`Message ${i} inconnu.`, 404);
		const chemins = c.candidates.map((x) => x.chemin);
		const donnes = Object.entries((corps['jugements'] ?? {}) as Record<string, JugementVue>).filter(([chemin]) => chemins.includes(chemin));
		const fusion: Record<string, JugementVue> = { ...c.jugements, ...Object.fromEntries(donnes) };
		if (corps['silence'] === true && Object.values(fusion).includes('pertinente')) throw new ErreurApi("« Rien d'utile ici » est refusé : une fiche de ce message est jugée utile.", 409);
		annulations.push([{ indice: i, cas: structuredClone(c) }]);
		if (corps['passer'] === true) c.saute = true;
		else {
			const reste = corps['silence'] === true || corps['resteNonUtile'] === true ? Object.fromEntries(chemins.map((x) => [x, 'non_pertinente' as const])) : {};
			const silence = corps['silence'] === true;
			c.jugements = silence ? Object.fromEntries(chemins.map((x) => [x, fusion[x] === 'indecise' ? 'indecise' : 'non_pertinente'])) : { ...reste, ...fusion };
			Object.assign(c, { silence, valide: true, valideLe: new Date().toISOString(), saute: false });
		}
		changer();
		return { suivant: prochain() };
	}

	function annuler(): ReponseAnnulation {
		const a = annulations.pop();
		if (a === undefined) throw new ErreurApi('Rien à annuler.', 409);
		for (const { indice, cas } of a) banc[indice] = cas;
		changer();
		return { indice: a[0]!.indice };
	}

	function accepterSures(): ReponseAccepterSures {
		const avantGeste: { indice: number; cas: Cas }[] = [];
		banc.forEach((c, indice) => {
			const p = c.propositions;
			if (!aRelire(c) || p === null || !c.candidates.every((x) => (p[x.chemin]?.confiance ?? 0) >= SEUIL_SUR)) return;
			avantGeste.push({ indice, cas: structuredClone(c) });
			// un jugement déjà donné à la main est gardé
			c.jugements = { ...Object.fromEntries(c.candidates.map((x) => [x.chemin, p[x.chemin]!.jugement])), ...c.jugements };
			c.valide = true;
			c.valideLe = new Date().toISOString();
		});
		if (avantGeste.length > 0) {
			annulations.push(avantGeste);
			changer();
		}
		return { acceptes: avantGeste.length };
	}

	return {
		/** GET : la réponse, ou undefined pour une route qui n'est pas de l'entraînement. */
		lire(chemin: string, params: Record<string, string> = {}): unknown {
			if (chemin === ROUTES.entrainement) return vue();
			if (chemin === ROUTES.entrainementMessage) return message(params);
			return undefined;
		},
		/** POST : la réponse, ou undefined pour une route qui n'est pas de l'entraînement. */
		envoyer(chemin: string, corps: Record<string, unknown>): unknown {
			switch (chemin) {
				case ROUTES.entrainementPreparer:
					return preparer(corps);
				case ROUTES.entrainementPrejuger:
					return prejuger();
				case ROUTES.entrainementApprendre:
					return apprendre();
				case ROUTES.entrainementArreter:
					return arreter();
				case ROUTES.entrainementRevenir:
					return revenir();
				case ROUTES.entrainementMessage:
					return repondre(corps);
				case ROUTES.entrainementAnnuler:
					return annuler();
				case ROUTES.entrainementAccepterSures:
					return accepterSures();
				default:
					return undefined;
			}
		},
	};
}
