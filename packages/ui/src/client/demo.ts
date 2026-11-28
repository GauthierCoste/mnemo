/**
 * Mode démo (`?demo`, en développement seulement, chargé par import dynamique) : une fausse `Api` et une fausse
 * `Connexion` sur les données de `demo-donnees.ts`, pour voir les vues sans service. Jamais dans la construction.
 */
import type { ChoixLangue, EtapeCalcul } from '@mnemo/commun';
import { ErreurApi, type Api } from './api.ts';
import { creerEntrainementDemo, type DepartEntrainementDemo } from './demo-entrainement.ts';
import { lotsDemo } from './demo-lots.ts';
import { fichesDeVolume } from './demo-volume.ts';
import { creerModelesDemo } from './demo-modeles.ts';
import { creerClaudeDesktopDemo } from './demo-claude-desktop.ts';
import { creerProfilsDemo, type SkillsPourProfils } from './demo-profils.ts';
import { creerSkillsDemo } from './demo-skills.ts';
import { creerMoteursDemo } from './demo-moteurs.ts';
import type { Connexion, EtatConnexion, FluxTerminal } from './connexion.ts';
import type { Client } from './contexte.tsx';
import { ecranInitial, EFFACER_LIGNE, effacerInvite, indicateur, invite, majIndicateur, messageUtilisateur, NL, outil, reponse, sansSequences } from './demo-terminal.ts';
import {
	COMMITS_DEMO,
	DOSSIER_DES_PROJETS_DEMO,
	DOSSIERS_DEMO,
	FICHES_DEMO,
	FICHIERS_EXISTANTS_DEMO,
	RACINE_ABSOLUE_DEMO,
	RACINE_DEMO,
	REPONSES_ARCHIVISTE_DEMO,
	REPONSES_TERMINAL_DEMO,
	CLASSEMENT_VIVANT_DEMO,
	COUPURE_DEMO,
	type MessageClasseDemo,
	ORDRE_SEUL_DEMO,
	SUGGESTION_DEMO,
	type PisteDemo,
	SERVI_PAR_ARCHIVISTE_DEMO,
	REGLAGES_DEMO,
	SESSIONS_DEMO,
	type SessionDemo,
} from './demo-donnees.ts';
import {
	ROUTES,
	type CarteVue,
	type ClassementVue,
	type CoupureInjectionVue,
	type RaisonCarteVue,
	type EcarteVue,
	type EcarteeToujoursVue,
	type InjectionVue,
	type EntreeServieVue,
	type LueVue,
	type MessageClient,
	type MessageServeur,
	type ResultatEcriture,
	type SessionVue,
	type BilanAmorceVue,
	type ChampReglageVue,
	type DonneesGraphe,
	type DocumentVue,
	type DossierVue,
	type NiveauDossiersVue,
	type ElementIndexeVue,
	type FicheGraphe,
	type FicheVue,
	type FilVue,
	type GitDossierVue,
	type LienGraphe,
	type LotVue,
	type NiveauVue,
	type RegleVue,
	type ReglagesVue,
	type ReponseDocuments,
	type ReponseLots,
	type ReponseEcritureSkill,
	type ReponseRejetLot,
	type ReponseValidationLot,
	type ReponseMarquerTraite,
	type ReponseRecherche,
	type ReponseTraiter,
	type SanteVue,
	type SessionTermineeVue,
	type TrouveVue,
	type ReponseFenetres,
	type ReponseQuotas,
} from '@mnemo/contrat';
import { A_TRAITER_MAX, avecAvertissements, consigneATraiter, demandeTout, DOCUMENTS_MAX, DOSSIERS_FIXES, estIdMoteur, estNiveauModeles, ECHANTILLON_NATURE, motifSiNonCherchable, plier, PROFIL_ARCHIVISTE, PROFIL_TRAVAIL, TAILLE_MAX_DOCUMENT, tailleLisible } from '@mnemo/commun';

const MINUTE = 60_000;
const LATENCE_MS = 90;
/** Durée d'une liaison de moteur en démo (« Lier à Mnemo »). */
const DUREE_LIAISON_MS = 700;
const COLONNES_PAR_DEFAUT = 80;

// --- Lecture des fiches (analyse simplifiée du format du coffre, suffisante pour les données fictives) ---

type FicheAnalysee = {
	chemin: string;
	titre: string;
	type: string;
	alias: string[];
	frontmatter: [string, string][];
	corps: string;
	brut: string;
	faits: { ancre: string | null; texte: string; categorie: string | null; barre: boolean; aConfirmer: boolean; debut: string | null; source: string | null; appris: string | null }[];
	liens: { ecrit: string; verbe: string | null }[];
};

function analyser(chemin: string, brut: string): FicheAnalysee {
	const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(brut);
	const tete = m?.[1] ?? '';
	const corps = (m?.[2] ?? brut).replace(/^\n+/, '');
	const frontmatter = tete
		.split('\n')
		.map((l) => /^([\w_]+):\s*(.*)$/.exec(l))
		.filter((x): x is RegExpExecArray => x !== null)
		.map((x): [string, string] => [x[1]!, x[2]!]);
	const valeur = (cle: string) => frontmatter.find(([k]) => k === cle)?.[1] ?? '';
	const alias = valeur('alias')
		.replace(/^\[|\]$/g, '')
		.split(',')
		.map((a) => a.trim())
		.filter(Boolean);
	const titre = /^# (.+)$/m.exec(corps)?.[1] ?? chemin.split('/').pop()!.replace(/\.md$/, '');
	const faits: FicheAnalysee['faits'] = [];
	const liens: FicheAnalysee['liens'] = [];
	let section = '';
	for (const ligne of corps.split('\n')) {
		if (ligne.startsWith('## ')) section = ligne.slice(3).trim();
		if ((section === 'Informations' || section === 'Faits') && ligne.startsWith('- ')) {
			const categorie = /^- \[([^\]]+)\]/.exec(ligne)?.[1] ?? null;
			const enonce = ligne.replace(/^- (\[[^\]]+\] )?/, '').split(' | ')[0] ?? '';
			faits.push({
				ancre: / \^(f-\d{4,9})$/.exec(ligne)?.[1] ?? null,
				texte: enonce.replace(/~~/g, ''),
				categorie,
				barre: enonce.startsWith('~~'),
				aConfirmer: ligne.includes(' | a confirmer'),
				debut: /valide \[(\d{4}-\d{2}-\d{2})/.exec(ligne)?.[1] ?? null,
				source: / \| src: (.+?)(?: \||$)/.exec(ligne)?.[1]?.trim() ?? null,
				appris: /\| appris (\d{4}-\d{2}-\d{2})/.exec(ligne)?.[1] ?? null,
			});
		}
		for (const l of ligne.matchAll(/\[\[([^\]]+)\]\]/g)) {
			const verbe = section === 'Relations' ? (/^- (.+?) \[\[/.exec(ligne)?.[1] ?? null) : null;
			// comme le service : la cible sans section, ancre, libellé ni `.md`
			liens.push({ ecrit: l[1]!.split(/[#|]/)[0]!.trim().replace(/\.md$/, ''), verbe });
		}
	}
	return { chemin, titre, type: valeur('type') || 'sujet', alias, frontmatter, corps, brut, faits, liens };
}

function empreinte(texte: string): string {
	// FNV-1a 32 bits (base et multiplicateur en décimal).
	let h = 2166136261;
	for (let i = 0; i < texte.length; i++) {
		h ^= texte.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

/** Champs d'un résultat de recherche que la démonstration ne remplit pas. */
const TROUVE_VIDE: Omit<TrouveVue, 'id' | 'chemin' | 'genre' | 'typeFiche' | 'texte' | 'contexte' | 'score'> = {
	statut: 'servi',
	date: null,
	valideFin: null,
	finIncluse: false,
	categorie: null,
	portee: null,
	confiance: null,
	source: null,
	typeSource: null,
};

// --- La mémoire fictive ---

type Memoire = { fiches: Map<string, FicheAnalysee>; modifieeMs: number };

function resoudre(memoire: Memoire, ecrit: string): string | null {
	const cible = ecrit.split(/[#^|]/)[0]!.trim();
	if (memoire.fiches.has(`${cible}.md`)) return `${cible}.md`;
	const n = plier(cible);
	for (const f of memoire.fiches.values()) if (plier(f.titre) === n || f.alias.some((a) => plier(a) === n)) return f.chemin;
	return null;
}

function branche(chemin: string): string {
	return chemin.split('/').slice(0, -1).join('/');
}

function parent(memoire: Memoire, chemin: string): string | null {
	const morceaux = branche(chemin).split('/').filter(Boolean);
	for (let n = morceaux.length; n > 0; n--) {
		const d = morceaux.slice(0, n);
		const fiche = `${d.join('/')}/${d.at(-1)}.md`;
		if (fiche !== chemin && memoire.fiches.has(fiche)) return fiche;
	}
	return null;
}

function graphe(memoire: Memoire): DonneesGraphe {
	const fiches: FicheGraphe[] = [];
	const liens: LienGraphe[] = [];
	for (const f of memoire.fiches.values()) {
		const actifs = f.faits.filter((x) => !x.barre);
		const categories: Record<string, number> = {};
		for (const x of actifs) if (x.categorie) categories[x.categorie] = (categories[x.categorie] ?? 0) + 1;
		fiches.push({
			chemin: f.chemin,
			titre: f.titre,
			type: f.type,
			alias: f.alias,
			etats: actifs.some((x) => x.aConfirmer) ? ['a_confirmer'] : [],
			faitsActifs: actifs.length,
			categories,
			// comme le service : la date d'apprentissage (l'index ne garde pas le début de validité)
			dates: actifs.map((x) => x.appris).filter((d): d is string => d !== null),
			branche: branche(f.chemin),
			parent: parent(memoire, f.chemin),
		});
		for (const l of f.liens) liens.push({ source: f.chemin, cible: resoudre(memoire, l.ecrit), cibleEcrite: l.ecrit, relation: l.verbe });
	}
	return { coffre: '_mnemo', fiches, liens, notions: [], sens: { disponible: true, etat: 'prêt' }, modifieeMs: memoire.modifieeMs };
}

// --- Le monde fictif : sessions, mémoire, fil ---

type Monde = {
	sessions: SessionVue[];
	memoire: Memoire;
	fil: FilVue;
	/** Commits écrits pendant la démonstration (Confirmer, Corriger, édition brute…). */
	commitsEnPlus: FilVue['commits'];
	servis: Map<string, EntreeServieVue[]>;
	/** Écartés par session (« ne plus suggérer »). */
	ecartes: Map<string, EcarteVue[]>;
	/** Fiches écartées toujours (« Ne plus jamais suggérer »). */
	ecarteesToujours: EcarteeToujoursVue[];
	/** Injections à la main et par Mnemo, par session, plus récentes d'abord (journal des gestes). */
	injections: Map<string, InjectionVue[]>;
	/** Injection automatique coupée par le suivi (`&coupure=1`). */
	coupures: CoupureInjectionVue[];
};

function vueSession(s: SessionDemo, maintenant: number): SessionVue {
	return {
		id: s.id,
		profil: s.profil,
		dossier: s.dossier,
		position: s.profil === PROFIL_ARCHIVISTE ? '' : `${DOSSIER_DES_PROJETS_DEMO}/${s.dossier}`,
		projet: s.dossier || 'mnemo',
		dossierNonRattache: null,
		objectif: s.objectif,
		etat: s.etat,
		creeeMs: maintenant - s.ageMin * MINUTE,
		majMs: maintenant - s.calmeMin * MINUTE,
		bilanDemandeMs: null,
		commitDebut: 'a3f9c21',
		branche: s.branche,
		terminal: s.terminal ?? true,
		dialogueOuvert: false,
		niveauModeles: null,
		...(s.moteur === undefined ? {} : { moteur: s.moteur }),
		...(s.modele === undefined ? {} : { modele: s.modele }),
		...(s.sansReprise === undefined || s.etat === 'terminee' ? {} : { sansReprise: s.sansReprise }),
	};
}

/** La session dans son nouvel état ; terminée, sans motif d'impossible reprise (comme la vue du service). */
function avecEtat(s: SessionVue, etat: SessionVue['etat']): SessionVue {
	const { sansReprise, ...reste } = s;
	return { ...reste, etat, majMs: Date.now(), ...(sansReprise === undefined || etat === 'terminee' ? {} : { sansReprise }) };
}

function texteServi(memoire: Memoire, ids: string[]): string {
	return ids
		.map((id) => {
			const [chemin, ancre] = id.split('#');
			const f = memoire.fiches.get(chemin!);
			if (!f) return '';
			const fait = ancre ? f.faits.find((x) => x.ancre === ancre) : null;
			return fait ? `- ${f.titre} : ${fait.texte}` : `## ${f.titre}\n${f.corps.split('\n').find((l) => l && !l.startsWith('#')) ?? ''}`;
		})
		.join('\n');
}

/** Titre affiché d'un id (fiche, ou `chemin#f-NNNN`) : celui de sa fiche. */
function titreDemo(memoire: Memoire, id: string): string {
	const chemin = id.split('#')[0]!;
	return memoire.fiches.get(chemin)?.titre ?? chemin;
}

/** Classement fictif, une ligne par fiche, dans l'ordre donné (notes décroissantes) : [id, note, servie]. */
function classementDemo(memoire: Memoire, lignes: readonly (readonly [string, number, boolean])[]): ClassementVue[] {
	const fiches = new Map<string, { note: number; servi: boolean }>();
	for (const [id, note, servi] of lignes) {
		const chemin = id.split('#')[0]!;
		const deja = fiches.get(chemin);
		fiches.set(chemin, { note: Math.max(deja?.note ?? 0, note), servi: (deja?.servi ?? false) || servi });
	}
	return [...fiches].map(([id, { note, servi }], i) => ({ id, titre: titreDemo(memoire, id), note, servi, rang: i + 1 }));
}

/** Cartes ◇ d'après des pistes fictives (titre de la fiche ; pour `liee`, la fiche injectée à la main d'où vient le poids). */
function cartesDemo(memoire: Memoire, pistes: readonly PisteDemo[]): CarteVue[] {
	// notes décroissantes, comme le classement du service ; une fiche nommée a aussi sa note (le service la note sans la reclasser)
	return pistes.map((p, i) => ({
		id: p.id,
		titre: titreDemo(memoire, p.id),
		raison: p.raison,
		...(p.depuis !== undefined ? { depuis: { id: p.depuis, titre: titreDemo(memoire, p.depuis) } } : {}),
		note: Math.round((0.86 - i * 0.07) * 100) / 100,
	}));
}

/** Signaux bruts fictifs d'une ligne, cohérents avec sa note ; le logit seulement après l'affinage (reranker). */
function signauxDemo(p: number, raison: RaisonCarteVue, affine: boolean): NonNullable<ClassementVue['signaux']> {
	const r = (n: number) => Math.round(n * 1000) / 1000;
	return {
		...(affine ? { logit: r((p - 0.5) * 8) } : {}),
		cosinus: r(0.45 + p / 3),
		cosinusRelatif: r(p - 0.4),
		cosinusZ: r((p - 0.5) * 3),
		bm25Relatif: raison === 'nommee' ? 1 : r(p * 0.6),
		apriori: raison === 'historique' ? 0.4 : 0,
		signalSession: raison === 'liee' ? 0.3 : 0,
	};
}

/**
 * Une entrée du classement vivant, comme le service la rend : les lignes du message (au hook, ou affinées), avec `p` si la note
 * est calibrée (sinon l'ordre seul), `auto` pour la fiche injectée par Mnemo, `piste` pour celles envoyées en piste.
 */
function entreeVivante(
	memoire: Memoire,
	session: string,
	horodatageMs: number,
	m: MessageClasseDemo,
	o: { ids: string[]; calibre: boolean; affinage: 'en_cours' | 'fait' | null; coupee?: boolean },
): EntreeServieVue {
	const lignes = o.affinage === 'fait' && m.affine ? m.affine : m.hook;
	// injection coupée par le suivi : les % restent, Mnemo n'injecte rien
	const auto = o.calibre && o.coupee !== true ? m.auto : undefined;
	const ids = [...o.ids, ...(auto ? [auto] : [])];
	const classement: ClassementVue[] = lignes.map(([id, p, raison], i) => ({
		id,
		titre: titreDemo(memoire, id),
		note: o.calibre ? p : null,
		servi: id === auto,
		rang: i + 1,
		p: o.calibre ? p : null,
		// ordre seul : la note du modèle de départ livré avec Mnemo (ce que voit une mémoire qui n'a pas encore entraîné la sienne), en gris
		...(o.calibre ? {} : { pNonCalibree: p, depart: true as const }),
		signaux: signauxDemo(p, raison, o.affinage === 'fait'),
		...(id === auto ? { auto: true as const } : {}),
		...(m.pistes.includes(id) ? { piste: true as const } : {}),
		raison,
	}));
	return {
		session,
		moment: 'message',
		horodatageMs,
		ids,
		texte: texteServi(memoire, ids),
		ms: 61,
		sens: true,
		classement,
		muet: null,
		cartes: m.pistes.map((id) => ({ id, titre: titreDemo(memoire, id), raison: lignes.find(([x]) => x === id)?.[2] ?? 'proche' })),
		titres: titresDemo(memoire, ids),
		...(o.affinage === null ? {} : { affinage: o.affinage }),
		calibree: o.calibre,
		mesure: o.calibre ? (o.affinage === 'fait' ? 'complets' : 'sens') : 'ordre',
	};
}

/** Titres des fiches d'`ids`, comme les entrées du service (chemin → titre). */
function titresDemo(memoire: Memoire, ids: readonly string[]): Record<string, string> {
	return Object.fromEntries(ids.map((id) => [id, titreDemo(memoire, id)]));
}

/** Classement initial d'une session : ses servies (notes décroissantes), puis ses seulement classées. */
function classementInitial(memoire: Memoire, s: SessionDemo): ClassementVue[] {
	return classementDemo(memoire, [...s.servis.map((id, i) => [id, 0.93 - i * 0.07, true] as const), ...(s.classees ?? []).map(([id, note]) => [id, note, false] as const)]);
}

/** Aujourd'hui en AAAA-MM-JJ, heure locale. */
function aujourdhuiTexte(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function aujourdhuiA(heure: string): number {
	const [h, m] = heure.split(':').map(Number);
	const d = new Date();
	d.setHours(h ?? 0, m ?? 0, 0, 0);
	return d.getTime();
}

const NIVEAUX: readonly NiveauVue[] = ['rappelee', 'toujours', 'verifiee'];
const niveauDe = (n: string | undefined, defaut: NiveauVue): NiveauVue => (NIVEAUX.includes(n as NiveauVue) ? (n as NiveauVue) : defaut);

/** Fait à confirmer, à la forme d'`ElementIndexe` du jalon 6. */
function elementAConfirmer(f: FicheAnalysee, x: FicheAnalysee['faits'][number]): ElementIndexeVue {
	const personnel = x.source !== null && /^(utilisateur|session|deduction)\b/.test(x.source);
	return {
		id: `${f.chemin}#^${x.ancre}`,
		chemin: f.chemin,
		genre: 'fait',
		typeFiche: f.type,
		texte: x.texte,
		contexte: `${branche(f.chemin).split('/').filter(Boolean).join(' › ')} › ${f.titre}`,
		statut: 'a_confirmer',
		date: x.appris,
		valideFin: null,
		finIncluse: false,
		confiance: null,
		source: x.source,
		typeSource: personnel ? x.source!.split(' ')[0]! : null,
		categorie: x.categorie,
		niveau: null,
		portee: null,
		dossierProjet: null,
	};
}

/** Règle d'une proposition écrite en ligne (`regle: { type: …, motifs: ["…"] }`). */
function regleDe(texte: string): RegleVue | undefined {
	const type = /regle: \{ type: (chemins_interdits|commandes_interdites)/.exec(texte)?.[1] as RegleVue['type'] | undefined;
	if (!type) return undefined;
	const motifs = [.../motifs: \[([^\]]*)\]/.exec(texte)?.[1]?.matchAll(/"([^"]*)"/g) ?? []].map((m) => m[1]!);
	return { type, motifs };
}

function filDuJour(memoire: Memoire, commitsEnPlus: FilVue['commits']): FilVue {
	const aConfirmer: ElementIndexeVue[] = [];
	const montees: FilVue['montees'] = [];
	for (const f of memoire.fiches.values()) {
		for (const x of f.faits) if (x.aConfirmer && !x.barre) aConfirmer.push(elementAConfirmer(f, x));
		const proposition = f.frontmatter.find(([k]) => k === 'proposition')?.[1];
		if (f.type === 'consigne' && proposition) {
			const niveau = niveauDe(/niveau: (\w+)/.exec(proposition)?.[1], 'toujours');
			const regle = regleDe(proposition);
			montees.push({
				fiche: f.chemin,
				texte: f.corps.split('\n').find((l) => l && !l.startsWith('#')) ?? f.titre,
				niveau,
				proposition: { niveau, ...(regle ? { regle } : {}), date: /date: ([\d-]+)/.exec(proposition)?.[1] ?? '', source: /source: ([^,}]+)/.exec(proposition)?.[1]?.trim() ?? 'session' },
			});
		}
	}
	const commits = COMMITS_DEMO.map(([heure, message, fiches, rang], i) => ({
		hash: empreinte(`${i}${message}`).slice(0, 7),
		dateMs: aujourdhuiA(heure),
		message,
		fiches,
		session: rang === null ? null : (SESSIONS_DEMO[rang]?.id ?? null),
	}));
	const tous = [...commitsEnPlus, ...commits].sort((a, b) => b.dateMs - a.dateMs);
	return { commits: tous, tronque: false, aConfirmer, montees, modifications: [] };
}

function creerMonde(volume = false): Monde {
	const maintenant = Date.now();
	const toutes = volume ? { ...fichesDeVolume(), ...FICHES_DEMO } : FICHES_DEMO;
	const memoire: Memoire = { fiches: new Map(Object.entries(toutes).map(([c, b]) => [c, analyser(c, b)])), modifieeMs: maintenant };
	const sessions = SESSIONS_DEMO.map((s) => vueSession(s, maintenant));
	const servis = new Map<string, EntreeServieVue[]>();
	for (const s of SESSIONS_DEMO) {
		const vue = sessions.find((x) => x.id === s.id)!;
		servis.set(
			s.id,
			s.servis.length
				? [
						{
							session: s.id,
							moment: s.pistes ? 'contexte' : 'debut',
							horodatageMs: vue.creeeMs + 2000,
							ids: s.servis,
							texte: texteServi(memoire, s.servis),
							ms: 38,
							sens: true,
							// format actuel pour les sessions qui ont des pistes : position ◆ + cartes ◇, classement vide
							classement: s.pistes ? [] : classementInitial(memoire, s),
							muet: null,
							cartes: cartesDemo(memoire, s.pistes ?? []),
							...(s.pistes ? { titres: titresDemo(memoire, s.servis) } : {}),
						},
					]
				: [],
		);
	}
	// classement vivant : la première session (note calibrée, une injection par Mnemo), la session des achats en ordre seul
	const injections = new Map<string, InjectionVue[]>();
	const premiere = SESSIONS_DEMO[0];
	if (premiere) {
		const debut = maintenant - 10 * MINUTE;
		const avant = maintenant - 6 * MINUTE;
		const position = servis.get(premiere.id)?.[0];
		if (position) Object.assign(position, { moment: 'message' as const, horodatageMs: debut });
		const entree = entreeVivante(memoire, premiere.id, avant, CLASSEMENT_VIVANT_DEMO.avant, { ids: [], calibre: true, affinage: 'fait' });
		servis.set(premiere.id, [entree, ...(servis.get(premiere.id) ?? [])]);
		injections.set(premiere.id, [{ chemin: CLASSEMENT_VIVANT_DEMO.avant.auto!, mode: 'auto', horodatageMs: avant, p: 0.94 }]);
	}
	const achats = SESSIONS_DEMO.find((s) => s.objectif === 'Écrire les tests du module achats');
	if (achats) {
		const entree = entreeVivante(memoire, achats.id, maintenant - 2 * MINUTE, ORDRE_SEUL_DEMO, { ids: [], calibre: false, affinage: null });
		servis.set(achats.id, [entree, ...(servis.get(achats.id) ?? [])]);
	}
	return { sessions, memoire, fil: filDuJour(memoire, []), commitsEnPlus: [], servis, ecartes: new Map(), ecarteesToujours: [], injections, coupures: [] };
}

// --- Fausse connexion : sessions, terminaux d'un faux `claude` (demo-terminal.ts) ---

type FausseConnexion = Connexion & { diffuser(m: MessageServeur): void };

function creerConnexionDemo(monde: Monde): FausseConnexion {
	let etat: EtatConnexion = 'connexion';
	const surEtats = new Set<(e: EtatConnexion) => void>();
	const surMessages = new Set<(m: MessageServeur) => void>();
	const abonnes = new Map<string, Set<(m: FluxTerminal) => void>>();
	const ecrans = new Map<string, string>();
	const saisies = new Map<string, string>();
	const colonnes = new Map<string, number>();
	/** Écrans encore tels que dessinés au départ : une nouvelle taille les redessine (comme `claude` sur SIGWINCH). */
	const vierges = new Set<string>();
	/** Sessions dont l'indicateur de réflexion est affiché au-dessus de l'invite. */
	const indicateurs = new Set<string>();
	/** Sessions qui répondent : la saisie est ignorée jusqu'à la réponse. */
	const occupees = new Set<string>();

	const diffuser = (m: MessageServeur) => {
		for (const f of [...surMessages]) f(m);
		if (m.type === 'sortie' || m.type === 'relecture' || m.type === 'retard') for (const f of [...(abonnes.get(m.session) ?? [])]) f(m);
	};
	const dessiner = (id: string) => {
		const travaille = monde.sessions.find((x) => x.id === id)?.etat === 'travaille';
		ecrans.set(id, ecranInitial(SESSIONS_DEMO.find((s) => s.id === id), colonnes.get(id) ?? COLONNES_PAR_DEFAUT, travaille));
		vierges.add(id);
		if (travaille) indicateurs.add(id);
		else indicateurs.delete(id);
	};
	const ecranDe = (id: string) => {
		if (!ecrans.has(id)) dessiner(id);
		return ecrans.get(id)!;
	};
	const sortie = (session: string, donnees: string) => {
		ecrans.set(session, ecranDe(session) + donnees);
		vierges.delete(session);
		diffuser({ type: 'sortie', session, donnees });
	};

	function taille(session: string, n: number): void {
		if (colonnes.get(session) === n) return;
		colonnes.set(session, n);
		if (!vierges.has(session)) return;
		dessiner(session);
		diffuser({ type: 'relecture', session, donnees: ecrans.get(session)! });
	}

	function repondre(session: string, texte: string): void {
		occupees.add(session);
		const s = monde.sessions.find((x) => x.id === session);
		if (s && s.etat !== 'travaille') changerEtat(s.id, 'travaille');
		const [reflexion, reponseCommune] = REPONSES_TERMINAL_DEMO;
		const reponseFinale = (s?.profil === PROFIL_ARCHIVISTE ? REPONSES_ARCHIVISTE_DEMO[texte.trim()] : undefined) ?? reponseCommune;
		const moteur = s?.moteur !== undefined && estIdMoteur(s.moteur) ? s.moteur : 'claude-code';
		sortie(session, `${effacerInvite(indicateurs.delete(session))}${messageUtilisateur(texte, moteur)}${NL}${NL}${indicateur(reflexion, moteur)}`);
		setTimeout(() => sortie(session, `${EFFACER_LIGNE}${outil('memoire_chercher', `« ${texte.slice(0, 40)} »`, '2 fiches injectées', moteur)}${NL}${NL}${indicateur(reflexion, moteur)}`), 600);
		setTimeout(() => {
			sortie(session, `${EFFACER_LIGNE}${reponse(reponseFinale, moteur)}${NL}${NL}${invite(colonnes.get(session) ?? COLONNES_PAR_DEFAUT, moteur)}`);
			occupees.delete(session);
			changerEtat(session, 'attend');
		}, 1600);
	}

	function entree(session: string, donnees: string): void {
		if (occupees.has(session)) return;
		for (const c of sansSequences(donnees)) {
			if (c === '\r') {
				const texte = saisies.get(session) ?? '';
				if (!texte.trim()) continue;
				saisies.set(session, '');
				repondre(session, texte);
				return;
			} else if (c === '\x7f') {
				const texte = saisies.get(session) ?? '';
				if (texte) {
					saisies.set(session, texte.slice(0, -1));
					sortie(session, '\b \b');
				}
			} else if (c >= ' ') {
				saisies.set(session, (saisies.get(session) ?? '') + c);
				sortie(session, c);
			}
		}
	}

	function changerEtat(id: string, e: SessionVue['etat']): void {
		const i = monde.sessions.findIndex((s) => s.id === id);
		if (i < 0) return;
		const s = avecEtat(monde.sessions[i]!, e);
		monde.sessions[i] = s;
		diffuser({ type: 'session', session: s });
	}

	// Ouverture après un court délai, comme un vrai service ; puis la session qui travaille avance de temps en temps.
	setTimeout(() => {
		etat = 'ouverte';
		for (const f of [...surEtats]) f(etat);
		diffuser({ type: 'sessions', sessions: [...monde.sessions] });
	}, 150);
	function servirDemo(entree: EntreeServieVue): void {
		// une entrée rediffusée (affinage) remplace la précédente au même horodatage, comme au service
		monde.servis.set(entree.session, [entree, ...(monde.servis.get(entree.session) ?? []).filter((e) => e.horodatageMs !== entree.horodatageMs)]);
		diffuser({ type: 'servi', entree });
	}
	// Peu après l'ouverture, l'archiviste sert une session (message `servi`, tiroir « Ce qu'il a fait pour les sessions »).
	const servie = SESSIONS_DEMO.find((s) => s.objectif === 'Faire passer les tests du dépôt SFTP');
	if (servie)
		setTimeout(() => {
			const ids = [...SERVI_PAR_ARCHIVISTE_DEMO.ids];
			const classement = classementDemo(monde.memoire, [[ids[1]!, 0.9, true], [ids[0]!, 0.84, true], ...SERVI_PAR_ARCHIVISTE_DEMO.autres]);
			servirDemo({ session: servie.id, moment: 'message', horodatageMs: Date.now(), ids, texte: texteServi(monde.memoire, ids), ms: 41, sens: true, classement, muet: null, cartes: SERVI_PAR_ARCHIVISTE_DEMO.autres.map(([id]) => ({ id, titre: titreDemo(monde.memoire, id), raison: 'question' as const })) });
		}, 1200);
	// Puis la première session reçoit deux messages : chacun classé au hook (« affinage… »), puis affiné en arrière-plan (même
	// entrée, lignes qui glissent) ; au second, Mnemo injecte l'export CSV (95 %).
	const premiere = SESSIONS_DEMO[0];
	if (premiere) {
		const [deuxieme, troisieme] = CLASSEMENT_VIVANT_DEMO.suivants;
		const etape = (e: EtapeCalcul | null, apresMs: number) => setTimeout(() => diffuser({ type: 'etape', session: premiere.id, etape: e }), apresMs);
		const classer = (m: MessageClasseDemo, apresMs: number) => {
			// les étapes du hook avant l'entrée du message, celles de l'affinage pendant qu'il dure (comme le service)
			const hook: [EtapeCalcul, number][] = [
				[{ nom: 'recherche' }, -900],
				[{ nom: 'reranker' }, -600],
				[{ nom: 'note' }, -350],
				...(m.auto ? ([[{ nom: 'lecture' }, -200]] as [EtapeCalcul, number][]) : []),
			];
			for (const [e, decalage] of hook) etape(e, apresMs + decalage);
			etape(null, apresMs);
			for (const [i, fait] of [0, 10, 20].entries()) etape({ nom: 'affinage', fait, total: 30 }, apresMs + 50 + i * 500);
			etape({ nom: 'note' }, apresMs + 1550);
			etape(null, apresMs + 1800);
			setTimeout(() => {
				const horodatageMs = Date.now();
				const coupee = monde.coupures.length > 0;
				servirDemo(entreeVivante(monde.memoire, premiere.id, horodatageMs, m, { ids: [], calibre: true, affinage: 'en_cours', coupee }));
				if (m.auto && !coupee) monde.injections.set(premiere.id, [{ chemin: m.auto, mode: 'auto', horodatageMs, p: m.hook.find(([id]) => id === m.auto)![1] }, ...(monde.injections.get(premiere.id) ?? [])]);
				setTimeout(() => servirDemo(entreeVivante(monde.memoire, premiere.id, horodatageMs, m, { ids: [], calibre: true, affinage: 'fait', coupee })), 1800);
			}, apresMs);
		};
		if (deuxieme) classer(deuxieme, 2500);
		if (troisieme) classer(troisieme, 9000);
	}
	const bavarde = SESSIONS_DEMO.find((s) => s.etat === 'travaille' && s.profil === PROFIL_TRAVAIL);
	let progression = 8;
	if (bavarde)
		setInterval(() => {
			if (progression >= 23 || !indicateurs.has(bavarde.id) || occupees.has(bavarde.id)) return;
			progression = Math.min(progression + 3, 23);
			sortie(bavarde.id, majIndicateur(`Tests : ${progression} sur 23`, bavarde.moteur));
		}, 4000);

	return {
		diffuser,
		etat: () => etat,
		surEtat(f) {
			surEtats.add(f);
			return () => void surEtats.delete(f);
		},
		surMessage(f) {
			surMessages.add(f);
			return () => void surMessages.delete(f);
		},
		envoyer(m: MessageClient) {
			if (etat !== 'ouverte') return false;
			if (m.type === 'entree') entree(m.session, m.donnees);
			else if (m.type === 'taille') taille(m.session, m.colonnes);
			return true;
		},
		abonner(session, f) {
			const ensemble = abonnes.get(session) ?? new Set();
			abonnes.set(session, ensemble);
			ensemble.add(f);
			setTimeout(() => f({ type: 'relecture', session, donnees: ecranDe(session) }), 30);
			let actif = true;
			return () => {
				if (!actif) return;
				actif = false;
				ensemble.delete(f);
			};
		},
		fermer() {},
	};
}

// --- Fausse API ---

const DELAI_CHANGEMENT_EXTERNE_MS = 2500;

/** Ce qu'une « autre fenêtre » écrit dans la fiche : une information de plus, en fin de `## Informations` (ou du corps). */
function changementExterne(brut: string): string {
	const fait = '- [delai] La recette est avancée au 10/12/2026. | declare | src: utilisateur | a confirmer ^f-0099\n';
	const i = brut.indexOf('\n## Relations');
	return i < 0 ? `${brut}${fait}` : `${brut.slice(0, i)}\n${fait}${brut.slice(i + 1)}`;
}

export type OptionsDemo = {
	/** Chemin d'une fiche qu'une « autre fenêtre » modifie 2,5 s après le départ (`&conflit=1`). */
	changementExterne?: string;
	/** État de départ des modèles locaux (`&modeles=` : voir `DEPARTS_MODELES`, ou `anime`) ; absent : prêts. */
	modeles?: string;
	/** Injection automatique coupée par le suivi (`&coupure=1`). */
	coupure?: boolean;
	/** Suggestion de la règle des 3 sessions sur la première session, sa fiche écartée ici (`&suggestion=1`). */
	suggestion?: boolean;
	/** Départ de Mémoire › Entraîner, `&entrainement=` : `vide`, `sansjuge`, `volume`, `accepte` ; absent : un banc entamé. */
	entrainement?: DepartEntrainementDemo;
	/** Valeur de départ du réglage `interface.langue` (`&langue=en`) ; absent : la langue du système. */
	langue?: ChoixLangue;
	/** Quelques centaines de fiches fictives en plus, comme dans un coffre réel (`&volume=1`) : voir `demo-volume.ts`. */
	volume?: boolean;
};

function creerApiDemo(monde: Monde, connexion: FausseConnexion, o: OptionsDemo): Api {
	const attendre = <T>(f: () => T | Promise<T>): Promise<T> =>
		new Promise((resoudre, rejeter) =>
			setTimeout(() => {
				try {
					resoudre(f());
				} catch (e) {
					rejeter(e);
				}
			}, LATENCE_MS),
		);
	const introuvable = (quoi: string) => new ErreurApi(`${quoi} introuvable (données de démonstration).`, 404);
	// l'identifiant lu dans un chemin bâti sur ROUTES.session (`/:id`, puis `/<action>` s'il y en a une)
	const idDans = (route: string, chemin: string) => new RegExp(`^${route.replace(':id', '([^/]+)')}$`).exec(chemin)?.[1];
	const sessionDe = (chemin: string, action: string) => idDans(`${ROUTES.session}/${action}`, chemin);
	const idDeSession = (chemin: string) => idDans(ROUTES.session, chemin);

	function memoireChangee(message: string, fiches: string[]): void {
		monde.memoire.modifieeMs = Date.now();
		monde.commitsEnPlus.unshift({ hash: empreinte(message + Date.now()).slice(0, 7), dateMs: Date.now(), message, fiches, session: null });
		monde.fil = filDuJour(monde.memoire, monde.commitsEnPlus);
		connexion.diffuser({ type: 'memoire', modifieeMs: monde.memoire.modifieeMs });
	}

	function ficheVue(chemin: string): FicheVue {
		const f = monde.memoire.fiches.get(chemin);
		if (!f) throw introuvable(`Fiche ${chemin}`);
		const entrants: FicheVue['liens']['entrants'] = [];
		for (const autre of monde.memoire.fiches.values())
			for (const l of autre.liens) if (autre.chemin !== chemin && resoudre(monde.memoire, l.ecrit) === chemin) entrants.push({ chemin: autre.chemin, titre: autre.titre, verbe: l.verbe });
		const sessions = monde.sessions
			.filter((s) => (monde.servis.get(s.id) ?? []).some((e) => e.ids.some((id) => id.split('#')[0] === chemin)))
			.map((s) => ({ id: s.id, objectif: s.objectif, etat: s.etat, horodatageMs: s.creeeMs }));
		const proprietes = f.frontmatter.filter(([k]) => k !== 'id' && k !== 'updated');
		const updated = f.frontmatter.find(([k]) => k === 'updated');
		return {
			chemin,
			titre: f.titre,
			type: f.type,
			proprietes: updated ? [...proprietes, updated] : proprietes,
			corps: f.corps,
			brut: f.brut,
			empreinte: empreinte(f.brut),
			liens: { sortants: f.liens.map((l) => ({ ecrit: l.ecrit, chemin: resoudre(monde.memoire, l.ecrit), verbe: l.verbe })), entrants },
			sessions,
			sessionsTotal: sessions.length,
			avertissements: [],
			// la démonstration ne calcule pas les portées : « Ce projet » vient des sessions
			projet: null,
		};
	}

	/** Remplace la ligne du fait `^ancre` de la fiche ; erreur 400 (comme le service) si le fait n'existe pas. */
	function changerFait(chemin: string, ancre: string, changer: (ligne: string) => string): void {
		const f = monde.memoire.fiches.get(chemin);
		if (!f) throw new ErreurApi(`Refusé : la fiche ${chemin} n'existe pas.`, 400);
		const motif = new RegExp(`^- .* \\^${ancre}$`, 'm');
		const ligne = motif.exec(f.brut)?.[0];
		if (!ligne) throw new ErreurApi(`Refusé : l'information ^${ancre} n'existe pas dans ${chemin}.`, 400);
		monde.memoire.fiches.set(chemin, analyser(chemin, f.brut.replace(ligne, changer(ligne))));
	}

	/** `proposer` de l'interface : confirmer, rejeter, corriger un fait (`fait` avec `remplace`) ; appliquer ou rejeter un niveau. */
	function proposer(corps: Record<string, unknown>): unknown {
		const fiche = String(corps['fiche'] ?? '');
		const ancre = String(corps['ancre'] ?? corps['remplace'] ?? '').replace(/^.*#/, '').replace(/^\^/, '');
		const sansAConfirmer = (l: string) => l.replace(' | a confirmer', '');
		switch (corps['genre']) {
			case 'confirmer':
				changerFait(fiche, ancre, sansAConfirmer);
				memoireChangee(`mnemo: confirme ${fiche}`, [fiche]);
				break;
			case 'rejeter':
				changerFait(fiche, ancre, (l) => sansAConfirmer(l).replace(/^- (\[[^\]]+\] )?(.+?) \| /, (_m, cat: string | undefined, texte: string) => `- ${cat ?? ''}~~${texte}~~ | `));
				memoireChangee(`mnemo: rejette ${fiche}`, [fiche]);
				break;
			case 'fait': {
				const f = monde.memoire.fiches.get(fiche);
				if (!f) throw new ErreurApi(`Refusé : la fiche ${fiche} n'existe pas.`, 400);
				const prochaine = Math.max(0, ...f.faits.map((x) => Number(x.ancre?.slice(2) ?? 0))) + 1;
				const nouvelle = `f-${String(prochaine).padStart(4, '0')}`;
				const categorie = typeof corps['categorie'] === 'string' ? `[${corps['categorie']}] ` : '';
				const ligne = `- ${categorie}${String(corps['texte'] ?? '')} | declare | src: utilisateur | appris ${aujourdhuiTexte()} | confiance 100 % ^${nouvelle}`;
				changerFait(fiche, ancre, (l) => `${sansAConfirmer(l).replace(/^- (\[[^\]]+\] )?(.+?) \| /, (_m, cat: string | undefined, texte: string) => `- ${cat ?? ''}~~${texte}~~ | `)}\n${ligne}`);
				memoireChangee(`mnemo: information ${fiche}`, [fiche]);
				return { statut: 'ecrit', fiche, ancre: nouvelle, aConfirmer: false, commit: 'demo' };
			}
			case 'niveau': {
				const f = monde.memoire.fiches.get(fiche);
				if (!f || f.type !== 'consigne') throw new ErreurApi(`Refusé : ${fiche} n'est pas une consigne.`, 400);
				let brut = f.brut.replace(/^proposition: .*\n/m, '');
				if (corps['retirerProposition'] !== true) brut = brut.replace(/^niveau: .*$/m, `niveau: ${String(corps['niveau'] ?? 'toujours')}`);
				monde.memoire.fiches.set(fiche, analyser(fiche, brut));
				memoireChangee(`mnemo: ${corps['retirerProposition'] === true ? 'rejette niveau' : 'niveau'} ${fiche}`, [fiche]);
				break;
			}
			default:
				throw new ErreurApi(`Refusé : genre « ${String(corps['genre'])} » non pris en charge par la démonstration.`, 400);
		}
		return { statut: 'ecrit', fiche, aConfirmer: false, commit: 'demo' } satisfies ResultatEcriture;
	}

	/** Comme le service : une fiche écartée toujours n'est plus suggérée ; les sessions qui la suggéraient sont rediffusées. */
	function sansSuggestion(fiche: string): void {
		monde.sessions = monde.sessions.map((x) => {
			if (!x.suggestionsEcarteeToujours?.some((g) => g.chemin === fiche)) return x;
			const { suggestionsEcarteeToujours: suggestions, ...reste } = x;
			const restantes = (suggestions ?? []).filter((g) => g.chemin !== fiche);
			const y = restantes.length === 0 ? reste : { ...reste, suggestionsEcarteeToujours: restantes };
			connexion.diffuser({ type: 'session', session: y });
			return y;
		});
	}

	/** Comme le service : les écartés de la session, rendus et diffusés. */
	function ecartesDe(session: string, ecartes: EcarteVue[]): { ecartes: EcarteVue[] } {
		monde.ecartes.set(session, ecartes);
		connexion.diffuser({ type: 'ecartes', session, ecartes });
		return { ecartes };
	}

	/** Comme le service : les fiches à servir de la session, rendues et diffusées. */
	const aServir = new Map<string, string[]>();
	function aServirDe(session: string, chemins: string[]): { chemins: string[] } {
		aServir.set(session, chemins);
		connexion.diffuser({ type: 'aServir', session, chemins });
		return { chemins };
	}

	/** Lots d'informations proposés par l'archiviste, en attente ; chaque décision diffuse `lots` (version suivante). */
	let lots: LotVue[] = lotsDemo(Date.now());
	let versionLots = 0;
	const VERBES_LOT: Record<LotVue['genre'], string> = { fusionner: 'fusionne', supprimer: 'supprime', confirmer: 'confirme' };
	/** Comme le service : le lot en attente `id` (404 sinon). */
	function lotEnAttente(id: string): LotVue {
		const lot = lots.find((l) => l.id === id);
		if (!lot) throw new ErreurApi('Lot inconnu ou déjà décidé.', 404);
		return lot;
	}
	/** Comme le service : le lot quitte l'attente, `lots` est diffusé. */
	function retirerLot(lot: LotVue): void {
		lots = lots.filter((l) => l !== lot);
		connexion.diffuser({ type: 'lots', version: String(++versionLots) });
	}
	/** Validation de démonstration : les lignes choisies sont vérifiées, le commit est noté, les fiches ne changent pas. */
	function validerLot(id: string, corps: Record<string, unknown>): ReponseValidationLot {
		const lot = lotEnAttente(id);
		// comme le service : une information visée a changé depuis la proposition, le lot est écarté
		if (lot.perime) {
			retirerLot(lot);
			throw new ErreurApi('Une information visée par le lot a changé depuis sa proposition : lot écarté, demander à l’archiviste de le reproposer.', 409);
		}
		const choisies = Array.isArray(corps['lignes']) ? corps['lignes'] : [];
		const lignes = [...new Set(choisies)].sort((a, b) => a - b);
		if (lignes.length === 0 || lignes.length !== choisies.length || lignes.some((i) => !lot.lignes.some((l) => l.indice === i))) throw new ErreurApi('Refusé : choix de lignes vide, en double ou hors du lot.', 400);
		retirerLot(lot);
		const n = lignes.length;
		memoireChangee(`mnemo: ${VERBES_LOT[lot.genre]} ${n} information${n > 1 ? 's' : ''} ${lot.fiche}`, [lot.fiche]);
		return { id: lot.id, fiche: lot.fiche, commit: 'demo', lignes, changements: [] };
	}

	/** Comme le service : les terminées, plus récentes d'abord, avec l'épisode dont la donnée `session` est leur id. */
	function historique(): SessionTermineeVue[] {
		const episodes = [...monde.memoire.fiches.values()].filter((f) => f.type === 'episode');
		return monde.sessions
			.filter((x) => x.etat === 'terminee')
			.sort((a, b) => b.majMs - a.majMs)
			.map((x) => {
				const e = episodes.find((f) => f.frontmatter.some(([k, v]) => k === 'session' && v === x.id));
				return { ...x, episode: e ? { chemin: e.chemin, titre: e.titre, minimal: e.frontmatter.some(([k, v]) => k === 'minimal' && v === 'true') } : null };
			});
	}

	/** Comme le service : fiches `source` sous `sources/`, plus récentes d'abord ; et toutes celles « à traiter ». */
	/** Comme le service : listes bornées, sauf `tout` (`demandeTout` sur la requête, ou un usage interne). */
	function documents(tout: boolean): ReponseDocuments {
		const valeur = (f: FicheAnalysee, cle: string) => f.frontmatter.find(([k]) => k === cle)?.[1] ?? null;
		const tous: DocumentVue[] = [...monde.memoire.fiches.values()]
			.filter((f) => f.type === 'source')
			.map((f) => ({ chemin: f.chemin, titre: f.titre, document: valeur(f, 'chemin'), date: valeur(f, 'updated') ?? '', aTraiter: valeur(f, 'a_traiter') === 'true' }))
			.sort((a, b) => b.date.localeCompare(a.date) || a.chemin.localeCompare(b.chemin));
		const aTraiter = tous.filter((d) => d.aTraiter);
		return { documents: tout ? tous : tous.slice(0, DOCUMENTS_MAX), aTraiter: tout ? aTraiter : aTraiter.slice(0, A_TRAITER_MAX), totalDocuments: tous.length, totalATraiter: aTraiter.length, dossiersNonRattaches: [], avertissements: [] };
	}

	/**
	 * Comme le service : la consigne part à l'archiviste qui tourne (sinon, en démo, rien ne le lance) ; elle nomme les fiches
	 * jusqu'à `CONSIGNE_CHEMINS_MAX`, et désigne la marque au-delà. `aucune` : le refus (409) quand il n'y a rien à confier.
	 */
	function confierALArchiviste(chemins: string[], aucune: string): ReponseTraiter {
		if (chemins.length === 0) throw new ErreurApi(aucune, 409);
		const archiviste = monde.sessions.find((x) => x.profil === PROFIL_ARCHIVISTE && x.etat !== 'terminee' && x.terminal);
		const consigne = consigneATraiter(chemins.length, chemins);
		if (archiviste) connexion.envoyer({ type: 'entree', session: archiviste.id, donnees: `${consigne}\r` });
		return { chemins, archiviste: 'confie' };
	}

	/** Comme le service : les chemins demandés qui sont des fiches « à traiter », sans doublon. */
	function aTraiterParmi(corps: Record<string, unknown>): string[] {
		const demandes = Array.isArray(corps['chemins']) ? corps['chemins'].filter((c): c is string => typeof c === 'string') : [];
		const marques = new Set(documents(true).aTraiter.map((d) => d.chemin));
		return [...new Set(demandes)].filter((c) => marques.has(c));
	}

	/** Fiches lues par une session, à leur heure (début de la session plus les minutes fictives), la plus récente d'abord. */
	function luesDemo(id: string): LueVue[] {
		const debut = monde.sessions.find((x) => x.id === id)?.creeeMs ?? Date.now();
		const lues = SESSIONS_DEMO.find((s) => s.id === id)?.lues ?? [];
		return lues.map(([chemin, min]) => ({ chemin, horodatageMs: debut + min * MINUTE })).sort((a, b) => b.horodatageMs - a.horodatageMs);
	}

	function lire(chemin: string, params: Record<string, string> = {}): unknown {
		const apercu = profilDe(ROUTES.profilApercu, chemin);
		if (apercu !== undefined) return profilsDemo.apercu(apercu);
		const profil = profilDe(ROUTES.profil, chemin);
		if (profil !== undefined) return profilsDemo.detail(profil);
		const skill = skillDe(ROUTES.skill, chemin, params);
		if (skill !== undefined) return skillsDemo.detail(skill.nom, skill.profil);
		const servis = sessionDe(chemin, 'servis');
		if (servis) return { servis: monde.servis.get(servis) ?? [], lues: luesDemo(servis), coupures: monde.coupures, injections: monde.injections.get(servis) ?? [] };
		const ecartes = sessionDe(chemin, 'ecartes');
		if (ecartes) return { ecartes: monde.ecartes.get(ecartes) ?? [] };
		const aServirLue = sessionDe(chemin, 'a-servir');
		if (aServirLue) return { chemins: aServir.get(aServirLue) ?? [] };
		const id = idDeSession(chemin);
		if (id !== undefined) {
			const session = monde.sessions.find((x) => x.id === decodeURIComponent(id));
			if (!session) throw introuvable('Session');
			return { session };
		}
		if (chemin === ROUTES.moteurs) return moteursDemo.lire(params['poste'] === '1');
		switch (chemin) {
			case ROUTES.ecarteesToujours:
				return { ecarteesToujours: monde.ecarteesToujours };
			case ROUTES.injectionAutomatique:
				return { coupures: monde.coupures };
			case ROUTES.fenetres:
				// fenêtres de contexte fictives, de plus en plus pleines, pour voir les trois couleurs de la jauge
				return { fenetres: Object.fromEntries(monde.sessions.filter((x) => x.etat !== 'terminee').map((x, i) => [x.id, { utilises: [38_000, 124_000, 171_000, 92_000, 58_000][i % 5]!, max: 200_000 }])) } satisfies ReponseFenetres;
			case ROUTES.quotas: {
				// quotas fictifs : Claude, fenêtre de 5 h à moitié, semaine bien entamée, remises dans 2 h et dans 3 jours ; ChatGPT, semaine seule
				const maintenant = Date.now();
				const claude = { cinqHeures: { pourcentage: 42, remiseMs: maintenant + 2 * 3_600_000 }, semaine: { pourcentage: 61, remiseMs: maintenant + 3 * 86_400_000 }, releveMs: maintenant };
				const chatgpt = { semaine: { pourcentage: 18, remiseMs: maintenant + 5 * 86_400_000 }, releveMs: maintenant };
				return { quotas: claude, moteurs: { 'claude-code': claude, codex: chatgpt } } satisfies ReponseQuotas;
			}
			case ROUTES.sessions:
				return { sessions: [...monde.sessions] };
			case ROUTES.lots:
				return { lots: structuredClone(lots) } satisfies ReponseLots;
			case ROUTES.profils:
				return profilsDemo.liste();
			case ROUTES.historique:
				return { sessions: historique() };
			case ROUTES.documents:
				return documents(demandeTout((cle) => params[cle]));
			case ROUTES.modeles:
				return modelesDemo.etat();
			case ROUTES.reglages:
				return reglagesDemo();
			case ROUTES.sante:
				return { ok: true, pid: 0, racine: RACINE_DEMO, racineAbsolue: RACINE_ABSOLUE_DEMO, terminaux: { ok: true }, version: '1.11.7' } satisfies SanteVue;
			case ROUTES.graphe:
				return graphe(monde.memoire);
			case ROUTES.fiche:
				return ficheVue(params['chemin'] ?? '');
			case ROUTES.dossiers: {
				const parent = params['chemin'] ?? '';
				if (parent !== '' && !DOSSIERS_DEMO.some((d) => d.chemin === parent)) throw introuvable(`Dossier ${parent}`);
				const vue = (chemin: string, git: boolean): DossierVue => ({
					chemin,
					nom: chemin.slice(chemin.lastIndexOf('/') + 1),
					git,
					marque: git,
					sessions: monde.sessions.filter((s) => s.dossier === chemin && s.etat !== 'terminee').length,
					erreur: null,
				});
				const sousDossiers = DOSSIERS_DEMO.filter((d) => d.chemin.slice(0, Math.max(0, d.chemin.lastIndexOf('/'))) === parent).map((d) => vue(d.chemin, d.git !== null));
				return { dossier: vue(parent, DOSSIERS_DEMO.find((d) => d.chemin === parent)?.git != null), sousDossiers } satisfies NiveauDossiersVue;
			}
			case ROUTES.dossierGit: {
				const d = DOSSIERS_DEMO.find((x) => x.chemin === params['chemin']);
				if (!d) throw introuvable(`Dossier ${params['chemin'] ?? ''}`);
				return (d.git ? { branche: d.git.branche, fichiers: d.git.fichiers.map(([c, statut]) => ({ chemin: c, statut })), modifies: d.git.modifies } : null) satisfies GitDossierVue;
			}
			case ROUTES.fil: {
				const jour = params['jour'] ?? '';
				return jour === aujourdhuiTexte() ? monde.fil : ({ commits: [], tronque: false, aConfirmer: monde.fil.aConfirmer, montees: monde.fil.montees, modifications: monde.fil.modifications } satisfies FilVue);
			}
			case ROUTES.recherche: {
				// comme le service : chaque mot doit figurer ; `dossier` et `genre` bornent ; `rapide=1` : les mots seuls, sans note du reranker
				const mots = plier(params['q'] ?? '')
					.split(/[^\p{L}\p{N}]+/u)
					.filter(Boolean);
				const dossier = params['dossier'] ?? '';
				const limite = Number(params['limite'] ?? '10') || 10;
				const tous = (textes: string[]) => mots.length > 0 && mots.every((m) => textes.some((t) => plier(t).includes(m)));
				const candidats: { trouve: TrouveVue; poids: number }[] = [];
				const genre = params['genre'];
				for (const f of monde.memoire.fiches.values()) {
					if (dossier && !f.chemin.startsWith(`${dossier}/`)) continue;
					if (genre !== undefined && (genre === 'document') !== (f.type === 'source')) continue;
					const segments = f.chemin.replace(/\.md$/, '').split('/');
					segments[segments.length - 1] = f.titre;
					const contexte = segments.join(' › ');
					const synthese = (f.corps.split('\n## ')[0] ?? '').replace(/^# .*\n?/, '').replace(/\s+/g, ' ').trim();
					if (tous([f.titre, ...f.alias, synthese]))
						candidats.push({
							trouve: { ...TROUVE_VIDE, id: f.chemin, chemin: f.chemin, genre: 'fiche', typeFiche: f.type, texte: [f.titre, synthese].filter(Boolean).join('\n\n'), contexte, score: 1 },
							poids: tous([f.titre, ...f.alias]) ? 1 : 0.75,
						});
					for (const x of f.faits)
						if (!x.barre && tous([x.texte]))
							candidats.push({
								trouve: {
									...TROUVE_VIDE,
									id: `${f.chemin}#^${x.ancre}`,
									chemin: f.chemin,
									genre: 'fait',
									typeFiche: f.type,
									texte: x.texte,
									contexte,
									statut: x.aConfirmer ? 'a_confirmer' : 'servi',
									date: x.appris,
									categorie: x.categorie,
									source: x.source,
									score: 0.8,
								},
								poids: 0.8,
							});
				}
				const rapide = params['rapide'] === '1';
				const trouves = candidats
					.sort((a, b) => b.poids - a.poids)
					.slice(0, limite)
					.map(({ trouve, poids }, i) => ({ ...trouve, score: poids, note: rapide ? null : Math.max(0.31, 0.94 - i * 0.07) }));
				return { trouves, avis: {} } satisfies ReponseRecherche;
			}
			default:
				throw introuvable(`Route ${chemin}`);
		}
	}

	function envoyer(chemin: string, corps: Record<string, unknown>): unknown {
		const aLier = idDans(ROUTES.moteurLier, chemin);
		// une liaison prend du temps chez le service (commandes du moteur) : le reflet du bouton se voit
		if (aLier !== undefined) {
			return new Promise((resoudre, rejeter) =>
				setTimeout(() => {
					try {
						resoudre(moteursDemo.lier(decodeURIComponent(aLier)));
					} catch (e) {
						rejeter(e);
					}
				}, DUREE_LIAISON_MS),
			);
		}
		const aValider = idDans(ROUTES.lotValider, chemin);
		if (aValider !== undefined) return validerLot(decodeURIComponent(aValider), corps);
		const aRejeter = idDans(ROUTES.lotRejeter, chemin);
		if (aRejeter !== undefined) {
			const lot = lotEnAttente(decodeURIComponent(aRejeter));
			retirerLot(lot);
			return { id: lot.id } satisfies ReponseRejetLot;
		}
		const copie = profilDe(ROUTES.profilDupliquer, chemin);
		if (copie !== undefined) return ecritureProfil(profilsDemo.dupliquer(copie, corps), String(corps['nom']));
		const aRetablir = skillDe(ROUTES.skillOrigine, chemin);
		if (aRetablir !== undefined) return ecritureSkill(skillsDemo.revenir(aRetablir.nom, aRetablir.profil), 'retablit', aRetablir.profil);
		const aCreer = skillDe(ROUTES.skills, chemin);
		if (aCreer !== undefined) return ecritureSkill(skillsDemo.creer(corps, aCreer.profil), 'cree', aCreer.profil);
		const demandeur = sessionDe(chemin, 'a-servir');
		if (demandeur) {
			const fiche = String(corps['chemin'] ?? '');
			return aServirDe(demandeur, [...(aServir.get(demandeur) ?? []).filter((c) => c !== fiche), fiche]);
		}
		const ecartant = sessionDe(chemin, 'ecartes');
		if (ecartant) {
			const id = String(corps['id'] ?? '');
			const classe = (monde.servis.get(ecartant) ?? []).flatMap((e) => [...e.classement, ...e.cartes]).find((c) => c.id === id);
			if (!classe) throw new ErreurApi('Élément absent des derniers classements de la session.', 404);
			const avant = monde.ecartes.get(ecartant) ?? [];
			return ecartesDe(ecartant, avant.some((e) => e.id === id) ? avant : [...avant, { id, titre: classe.titre, horodatageMs: Date.now() }]);
		}
		const actions: [string, SessionVue['etat']][] = [
			['pause', 'en_pause'],
			['reprise', 'travaille'],
			['bilan', 'travaille'],
			['abandon', 'terminee'],
		];
		for (const [action, etat] of actions) {
			const id = sessionDe(chemin, action);
			if (!id) continue;
			const i = monde.sessions.findIndex((s) => s.id === id);
			if (i < 0) throw introuvable('Session');
			const avant = monde.sessions[i]!;
			// comme le service : une session que son moteur ne peut pas reprendre n'a ni pause, ni reprise, ni bilan
			if (action !== 'abandon' && avant.sansReprise !== undefined) throw new ErreurApi(`${action === 'bilan' ? 'Bilan' : action === 'pause' ? 'Pause' : 'Reprise'} impossible : ${avant.sansReprise} ; l’abandonner à la place.`, 409);
			const s = {
				...avecEtat(avant, etat),
				bilanDemandeMs: action === 'bilan' ? Date.now() : avant.bilanDemandeMs,
				terminal: action === 'reprise' ? true : avant.terminal,
			};
			monde.sessions[i] = s;
			connexion.diffuser({ type: 'session', session: s });
			return { session: s };
		}
		switch (chemin) {
			case ROUTES.ecarteesToujours: {
				const fiche = String(corps['chemin'] ?? '');
				if (!monde.memoire.fiches.has(fiche)) throw introuvable(`Fiche ${fiche}`);
				if (!monde.ecarteesToujours.some((e) => e.chemin === fiche)) monde.ecarteesToujours = [...monde.ecarteesToujours, { chemin: fiche, titre: titreDemo(monde.memoire, fiche), horodatageMs: Date.now() }];
				sansSuggestion(fiche);
				return { ecarteesToujours: monde.ecarteesToujours };
			}
			case ROUTES.injectionAutomatique: {
				// comme le service : réactivée, la vue des sessions est rediffusée sans la coupure
				monde.coupures = [];
				monde.sessions = monde.sessions.map(({ injectionCoupee: _c, ...x }) => x);
				connexion.diffuser({ type: 'sessions', sessions: [...monde.sessions] });
				return { coupures: [] };
			}
			case ROUTES.modelesDemarrer:
				return modelesDemo.demarrer();
			case ROUTES.modelesArreter:
				return modelesDemo.arreter();
			case ROUTES.sessions: {
				const maintenant = Date.now();
				const s: SessionVue = {
					id: crypto.randomUUID(),
					profil: String(corps['profil'] ?? PROFIL_TRAVAIL),
					dossier: String(corps['dossier'] ?? ''),
					position: `${DOSSIER_DES_PROJETS_DEMO}/${String(corps['dossier'] ?? '')}`,
					projet: String(corps['dossier'] ?? '') || 'mnemo',
					dossierNonRattache: null,
					objectif: typeof corps['objectif'] === 'string' && corps['objectif'] ? corps['objectif'] : null,
					etat: 'travaille',
					creeeMs: maintenant,
					majMs: maintenant,
					bilanDemandeMs: null,
					commitDebut: null,
					branche: 'main',
					terminal: true,
					dialogueOuvert: false,
					niveauModeles: null,
				};
				monde.sessions.push(s);
				monde.servis.set(s.id, []);
				connexion.diffuser({ type: 'session', session: s });
				return { session: s };
			}
			case ROUTES.brut: {
				const cible = String(corps['chemin'] ?? '');
				const f = monde.memoire.fiches.get(cible);
				if (!f) throw introuvable(`Fiche ${cible}`);
				if (corps['empreinte'] !== empreinte(f.brut)) throw new ErreurApi("La fiche a changé depuis l'ouverture.", 409);
				const texte = String(corps['texte'] ?? '');
				// comme le service : le texte tel quel ; identique → rien à écrire
				if (texte === f.brut) return { statut: 'doublon', fiche: cible } satisfies ResultatEcriture;
				monde.memoire.fiches.set(cible, analyser(cible, texte));
				memoireChangee(`mnemo: brut ${cible}`, [cible]);
				return { statut: 'ecrit', fiche: cible, aConfirmer: false, commit: 'demo' } satisfies ResultatEcriture;
			}
			case ROUTES.proposer:
				return proposer(corps);
			case ROUTES.amorce:
				// démo : la mémoire de Claude Code est déjà importée, rien de nouveau
				return {
					notes: { nouvelles: 0, modifiees: 0, inchangees: 12 },
					instructions: { nouvelles: 0, modifiees: 0, inchangees: 2 },
					rattachees: 0,
					secrets: 0,
					ignores: [],
					fiches: [],
					aTraiter: 0,
					archiviste: 'rien',
					commit: null,
				} satisfies BilanAmorceVue;
			case ROUTES.sourcesTraiter:
				return confierALArchiviste(aTraiterParmi(corps), 'Aucune de ces fiches n’est à traiter.');
			case ROUTES.sourcesTraiterToutes: {
				const sauf = new Set(Array.isArray(corps['sauf']) ? corps['sauf'] : []);
				const chemins = documents(true).aTraiter.map((d) => d.chemin).filter((c) => !sauf.has(c));
				return confierALArchiviste(chemins, 'Aucune fiche n’est à traiter hors de celles déjà confiées.');
			}
			case ROUTES.sourcesMarquerTraite: {
				const traites = aTraiterParmi(corps);
				for (const c of traites) {
					const f = monde.memoire.fiches.get(c)!;
					monde.memoire.fiches.set(c, analyser(c, f.brut.replace(/^a_traiter: true\n/mu, '')));
				}
				if (traites.length > 0) memoireChangee(`mnemo: traitee ${traites.join(', ')}`, traites);
				return { traites } satisfies ReponseMarquerTraite;
			}
			case ROUTES.deplacer: {
				const de = String(corps['id'] ?? '');
				const dossier = String(corps['dossier'] ?? '').replace(/^\/+|\/+$/g, '');
				const f = monde.memoire.fiches.get(de);
				if (!f) throw introuvable(`Fiche ${de}`);
				const segments = de.split('/');
				const nom = segments.pop()!;
				// la fiche d'un dossier (d/d.md) emporte tout son dossier, comme le service
				if (segments.length > 0 && nom === `${segments[segments.length - 1]}.md`) {
					const ancien = segments.join('/');
					const nouveau = dossier ? `${dossier}/${segments[segments.length - 1]}` : segments[segments.length - 1]!;
					if (nouveau === ancien || nouveau.startsWith(`${ancien}/`)) throw new ErreurApi(`${nouveau} est dans le dossier déplacé ${ancien}.`, 400);
					const contenu = [...monde.memoire.fiches.keys()].filter((c) => c.startsWith(`${ancien}/`));
					if ([...monde.memoire.fiches.keys()].some((c) => c.startsWith(`${nouveau}/`))) throw new ErreurApi(`Le dossier ${nouveau} existe déjà.`, 400);
					const arrivees = contenu.map((c) => {
						const vers = `${nouveau}/${c.slice(ancien.length + 1)}`;
						const fiche = monde.memoire.fiches.get(c)!;
						monde.memoire.fiches.delete(c);
						monde.memoire.fiches.set(vers, analyser(vers, fiche.brut));
						return vers;
					});
					memoireChangee(`mnemo: déplace ${ancien} → ${nouveau}`, arrivees);
					return { statut: 'ecrit', fiche: `${nouveau}/${nom}`, aConfirmer: false, commit: 'demo' } satisfies ResultatEcriture;
				}
				const vers = dossier ? `${dossier}/${nom}` : nom;
				if (vers === de) throw new ErreurApi("Le chemin de destination est identique au chemin d'origine.", 400);
				if (monde.memoire.fiches.has(vers)) throw new ErreurApi(`${vers} existe déjà.`, 400);
				monde.memoire.fiches.delete(de);
				monde.memoire.fiches.set(vers, analyser(vers, f.brut));
				memoireChangee(`mnemo: deplacer ${de}`, [vers]);
				// comme le service : le nouveau chemin
				return { statut: 'ecrit', fiche: vers, aConfirmer: false, commit: 'demo' } satisfies ResultatEcriture;
			}
			default:
				throw introuvable(`Route ${chemin}`);
		}
	}

	// Réglages de la démo : en mémoire ; comme le service, le port changé attend un redémarrage
	// les profils lisent les skills, qui font suivre aux profils le renommage ou la suppression d'une skill de la mémoire
	const lienSkills: SkillsPourProfils = { memoire: () => [], duProfil: () => [], copierProfil: () => {}, retirerProfil: () => {} };
	const profilsDemo = creerProfilsDemo(lienSkills);
	const skillsDemo = creerSkillsDemo(profilsDemo);
	lienSkills.memoire = skillsDemo.memoire;
	lienSkills.duProfil = skillsDemo.duProfil;
	lienSkills.copierProfil = skillsDemo.copierProfil;
	lienSkills.retirerProfil = skillsDemo.retirerProfil;
	/** Une route de skill : l'identifiant de `route` dans le chemin (requête ôtée), et la portée `?profil=` (du chemin ou de `params`). */
	const skillDe = (route: string, chemin: string, params?: Record<string, string>): { nom: string; profil: string | null } | undefined => {
		const [sansRequete, requete] = chemin.split('?') as [string, string | undefined];
		const nom = route.includes(':id') ? profilDe(route, sansRequete) : sansRequete === route ? '' : undefined;
		if (nom === undefined) return undefined;
		const profil = params?.['profil'] ?? new URLSearchParams(requete ?? '').get('profil');
		return { nom, profil: profil === null || profil === '' ? null : profil };
	};
	const modelesDemo = creerModelesDemo(connexion.diffuser, { depart: o.modeles ?? null, session: monde.sessions.find((x) => x.etat !== 'terminee')?.id ?? null });
	/** Niveau des modèles propre à une session (null : comme partout), diffusé comme le fait le service. */
	const niveauDeSession = (id: string, corps: unknown): { session: SessionVue } => {
		const niveau = (corps as { niveau?: unknown } | null)?.niveau;
		if (niveau !== null && !estNiveauModeles(niveau)) throw new ErreurApi('Champ « niveau » invalide.', 400);
		const i = monde.sessions.findIndex((x) => x.id === id);
		if (i < 0) throw introuvable('Session');
		const session = { ...monde.sessions[i]!, niveauModeles: niveau };
		monde.sessions[i] = session;
		connexion.diffuser({ type: 'session', session });
		return { session };
	};
	const claudeDesktopDemo = creerClaudeDesktopDemo();
	const moteursDemo = creerMoteursDemo();
	const entrainementDemo = creerEntrainementDemo(connexion.diffuser, o.entrainement, o.langue === 'en');
	/** Route de profil (`:id`) du chemin, décodée ; undefined sinon. */
	const profilDe = (route: string, chemin: string) => {
		const id = idDans(route, chemin);
		return id === undefined ? undefined : decodeURIComponent(id);
	};
	const ecritureProfil = (r: { commit: string | null }, nom: string) => {
		if (r.commit !== null) memoireChangee(`mnemo: profil profils/${nom}/${nom}.md`, []);
		return r;
	};
	/** Une écriture de skill réussie, annoncée comme le service la commite (`action` : cree, modifie, supprime, retablit). */
	const ecritureSkill = (r: ReponseEcritureSkill, action: string, profil: string | null, ancien = r.nom) => {
		const dossier = profil === null ? DOSSIERS_FIXES.skills : `${DOSSIERS_FIXES.profils}/${profil}/${DOSSIERS_FIXES.skills}`;
		if (r.commit !== null) {
			const message =
				ancien !== r.nom ? `mnemo: renomme ${dossier}/${ancien} → ${dossier}/${r.nom}` : action === 'supprime' ? `mnemo: supprime ${dossier}/${r.nom}/` : `mnemo: ${action} ${dossier}/${r.nom}/SKILL.md`;
			memoireChangee(message, []);
		}
		return r;
	};
	let reglages = structuredClone(REGLAGES_DEMO).map((c) => (c.cle === 'interface.langue' && o.langue !== undefined ? { ...c, valeur: o.langue } : c));
	const reglagesDemo = (): ReglagesVue => ({
		champs: structuredClone(reglages),
		avertissements: [],
		enAttente: reglages.filter((c) => c.effet === 'service' && JSON.stringify(c.valeur) !== JSON.stringify(REGLAGES_DEMO.find((d) => d.cle === c.cle)?.valeur)).map((c) => c.cle),
	});
	function remplacerReglages(corps: unknown): ReglagesVue {
		const valeurs = (corps as { valeurs?: Record<string, unknown> } | null)?.valeurs ?? {};
		for (const cle of Object.keys(valeurs)) if (!reglages.some((c) => c.cle === cle)) throw new ErreurApi(`Réglages refusés : réglage inconnu « ${cle} ».`, 400);
		const suivants = reglages.map((c) => (c.cle in valeurs ? { ...c, valeur: (valeurs[c.cle] ?? c.defaut) as ChampReglageVue['valeur'] } : c));
		const valeur = (cle: string) => suivants.find((c) => c.cle === cle)?.valeur as number;
		if (valeur('contexte.seuilPiste') > valeur('contexte.seuilInjection')) {
			throw new ErreurApi(`Réglages refusés : le seuil des pistes (${valeur('contexte.seuilPiste')} %) dépasse le seuil d’injection automatique (${valeur('contexte.seuilInjection')} %).`, 400);
		}
		reglages = suivants;
		return reglagesDemo();
	}

	const deposes = new Set(FICHIERS_EXISTANTS_DEMO);

	// Mode démo `&conflit=1` : une autre fenêtre écrit la fiche peu après l'ouverture (avis « La fiche a changé sur le
	// disque » si elle est en édition ; l'enregistrement suivant, sur l'ancienne empreinte, est refusé en 409).
	if (o.changementExterne) {
		const cible = o.changementExterne;
		setTimeout(() => {
			const f = monde.memoire.fiches.get(cible);
			if (!f) return;
			monde.memoire.fiches.set(cible, analyser(cible, changementExterne(f.brut)));
			memoireChangee(`mnemo: brut ${cible}`, [cible]);
		}, DELAI_CHANGEMENT_EXTERNE_MS);
	}

	return {
		lire: <T>(chemin: string, params?: Record<string, string>, options?: { signal?: AbortSignal }) =>
			attendre(() => {
				options?.signal?.throwIfAborted();
				return (claudeDesktopDemo.traiter('GET', chemin) ?? entrainementDemo.lire(chemin, params) ?? lire(chemin, params)) as T;
			}),
		envoyer: <T>(chemin: string, corps?: unknown) =>
			attendre(() => {
				const objet = (corps ?? {}) as Record<string, unknown>;
				return (claudeDesktopDemo.traiter('POST', chemin, corps) ?? entrainementDemo.envoyer(chemin, objet) ?? envoyer(chemin, objet)) as T;
			}),
		remplacer: <T>(chemin: string, corps: unknown) =>
			attendre(() => {
				const app = claudeDesktopDemo.traiter('PUT', chemin, corps);
				if (app !== undefined) return app as T;
				const profil = profilDe(ROUTES.profil, chemin);
				if (profil !== undefined) return ecritureProfil(profilsDemo.enregistrer(profil, corps), profil) as T;
				const skill = skillDe(ROUTES.skill, chemin);
				if (skill !== undefined) return ecritureSkill(skillsDemo.modifier(skill.nom, corps, skill.profil), 'modifie', skill.profil, skill.nom) as T;
				if (chemin === ROUTES.modelesNiveau) return modelesDemo.niveau(corps) as T;
				const reglee = sessionDe(chemin, 'modeles');
				if (reglee) return niveauDeSession(reglee, corps) as T;
				if (chemin !== ROUTES.reglages) throw new ErreurApi('Route inconnue (données de démonstration).', 404);
				return remplacerReglages(corps) as T;
			}),
		supprimer: <T>(chemin: string, params?: Record<string, string>) =>
			attendre(() => {
				const app = claudeDesktopDemo.traiter('DELETE', chemin);
				if (app !== undefined) return app as T;
				const profil = profilDe(ROUTES.profil, chemin);
				if (profil !== undefined) return ecritureProfil(profilsDemo.supprimer(profil), profil) as T;
				const skill = skillDe(ROUTES.skill, chemin, params);
				if (skill !== undefined) return ecritureSkill(skillsDemo.supprimer(skill.nom, skill.profil), 'supprime', skill.profil) as T;
				// comme le service : seule une session terminée est retirée de l'historique
				const retiree = /^\/api\/sessions\/([^/]+)$/.exec(chemin)?.[1];
				if (retiree) {
					const x = monde.sessions.find((y) => y.id === retiree);
					if (!x) throw introuvable('Session');
					if (x.etat !== 'terminee') throw new ErreurApi('Seule une session terminée (sans terminal ouvert) peut être retirée de l’historique.', 409);
					monde.sessions = monde.sessions.filter((y) => y.id !== retiree);
					return { id: retiree } as T;
				}
				if (chemin === ROUTES.ecarteesToujours) {
					const fiche = params?.['chemin'] ?? '';
					if (!monde.ecarteesToujours.some((e) => e.chemin === fiche)) throw new ErreurApi('Cette fiche n’était pas écartée pour toujours.', 404);
					monde.ecarteesToujours = monde.ecarteesToujours.filter((e) => e.chemin !== fiche);
					return { ecarteesToujours: monde.ecarteesToujours } as T;
				}
				const annulee = sessionDe(chemin, 'a-servir');
				if (annulee) return aServirDe(annulee, (aServir.get(annulee) ?? []).filter((c) => c !== params?.['chemin'])) as T;
				const session = sessionDe(chemin, 'ecartes');
				if (!session) throw new ErreurApi('Route inconnue (données de démonstration).', 404);
				return ecartesDe(session, (monde.ecartes.get(session) ?? []).filter((e) => e.id !== params?.['id'])) as T;
			}),
		deposer: (vers: string, fichier: Blob, surProgression?: (envoyes: number, total: number) => void) =>
			attendre(async () => {
				if (fichier.size > TAILLE_MAX_DOCUMENT) throw new ErreurApi(`Document trop volumineux : « ${vers} » (plus de ${tailleLisible(TAILLE_MAX_DOCUMENT)}).`, 413);
				surProgression?.(fichier.size, fichier.size);
				if (deposes.has(vers)) throw new ErreurApi(`Le fichier « ${vers} » existe déjà : il n'est jamais remplacé.`, 409);
				deposes.add(vers);
				// Comme le service : l'archiviste qui tourne reçoit la consigne de traiter le document.
				const archiviste = monde.sessions.find((x) => x.profil === PROFIL_ARCHIVISTE && x.etat !== 'terminee' && x.terminal);
				if (archiviste) connexion.envoyer({ type: 'entree', session: archiviste.id, donnees: `Traite le document ${vers}\r` });
				// comme le service : la décision sur les premiers octets du fichier
				const motif = motifSiNonCherchable(vers, new Uint8Array(await fichier.slice(0, ECHANTILLON_NATURE).arrayBuffer()));
				return { chemin: vers, ...avecAvertissements(motif === null ? [] : [motif]) };
			}),
	};
}

/** Client de démonstration : données fictives, aucun jeton, aucun service. */
export function creerClientDemo(o: OptionsDemo = {}): Client {
	const monde = creerMonde(o.volume === true);
	if (o.coupure) {
		monde.coupures = [{ ...COUPURE_DEMO, depuisMs: Date.now() - 40 * MINUTE }];
		monde.sessions = monde.sessions.map((x) => ({ ...x, injectionCoupee: monde.coupures }));
	}
	const premiere = SESSIONS_DEMO[0];
	if (o.suggestion && premiere) {
		monde.ecartes.set(premiere.id, [{ id: SUGGESTION_DEMO.chemin, titre: titreDemo(monde.memoire, SUGGESTION_DEMO.chemin), horodatageMs: Date.now() - 4 * MINUTE }]);
		monde.sessions = monde.sessions.map((x) => (x.id === premiere.id ? { ...x, suggestionsEcarteeToujours: [SUGGESTION_DEMO] } : x));
	}
	const connexion = creerConnexionDemo(monde);
	return { api: creerApiDemo(monde, connexion, o), connexion, fictif: true, surJetonRefuse: () => () => {} };
}
