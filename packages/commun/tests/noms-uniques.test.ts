// TypeScript ne réserve pas un littéral à une constante : le parcours des sources le fait (comme OrderCostLineWriterInvariantTest).
// Un littéral contraint par une union fermée (onglet, groupe de réglages, action) est une autre notion : il est admis.
import { dirname, join, relative, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DOSSIERS_FIXES, EMPLACEMENTS_PAR_DEFAUT, PROFIL_ARCHIVISTE, PROFIL_TRAVAIL, PROJET_PAR_DEFAUT } from '../src/index.ts';

const RACINE = join(import.meta.dirname, '../../..');
const DEFINITION = 'packages/commun/src/memoire.ts';
const NOMS: readonly string[] = [...Object.values(EMPLACEMENTS_PAR_DEFAUT), ...Object.values(DOSSIERS_FIXES), PROJET_PAR_DEFAUT, PROFIL_ARCHIVISTE, PROFIL_TRAVAIL];
const PAQUETS = ['packages/commun', 'packages/contrat', 'packages/mnemo', 'packages/ui'];

/** Littéraux admis hors de la définition : `fichier` (relatif à la racine du dépôt), `symbole` qui le contient, texte exact, `nombre` d'occurrences, raison. */
const EXCEPTIONS: readonly { fichier: string; symbole: string; texte: string; nombre: number; raison: string }[] = [
	{ fichier: 'packages/commun/src/reglages.ts', symbole: 'GROUPES_REGLAGES', texte: 'archiviste', nombre: 1, raison: 'nom du groupe de réglages de l’archiviste' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'sourcesTraiter', texte: '/api/memoire/sources/traiter', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'sourcesMarquerTraite', texte: '/api/memoire/sources/marquer-traite', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'profils', texte: '/api/profils', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'profil', texte: '/api/profils/:id', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'profilDupliquer', texte: '/api/profils/:id/dupliquer', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'profilApercu', texte: '/api/profils/:id/apercu', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'skills', texte: '/api/skills', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'skill', texte: '/api/skills/:id', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'skillOrigine', texte: '/api/skills/:id/origine', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/ui/src/main.tsx', symbole: 'archiviste', texte: 'archiviste', nombre: 1, raison: 'paramètre d’adresse du mode démo' },
	{ fichier: 'packages/ui/src/main.tsx', symbole: 'departDemo', texte: 'archiviste', nombre: 1, raison: 'onglet demandé par l’adresse du mode démo' },
	{ fichier: 'packages/mnemo/src/adaptateurs/cli/banc.ts', symbole: 'commandeBanc', texte: 'consignes', nombre: 1, raison: 'nom du banc des consignes (commande `mnemo banc consignes`)' },
	{ fichier: 'packages/mnemo/src/adaptateurs/cli/banc.ts', symbole: 'consignes', texte: 'consignes', nombre: 2, raison: 'section `consignes` du fichier de banc et son libellé d’erreur' },
	{ fichier: 'packages/contrat/src/index.ts', symbole: 'sourcesTraiterToutes', texte: '/api/memoire/sources/traiter-toutes', nombre: 1, raison: 'chemin d’une route HTTP (ROUTES)' },
	{ fichier: 'packages/mnemo/src/domaine/profil.ts', symbole: 'CLES_GEREES_DU_PROFIL', texte: 'skills', nombre: 1, raison: 'ancienne clé `skills` du frontmatter d’une fiche profil (v1.0), retirée à l’enregistrement' },
	{ fichier: 'packages/ui/src/langue/textes/fr/sessions.tsx', symbole: 'autre', texte: 'skills', nombre: 1, raison: 'pluriel du mot « skill » dans l’équipement d’un agent, pas le dossier de la mémoire' },
	{ fichier: 'packages/ui/src/langue/textes/en/sessions.tsx', symbole: 'autre', texte: 'skills', nombre: 1, raison: 'pluriel anglais du mot « skill » dans l’équipement d’un agent, pas le dossier de la mémoire' },
	{ fichier: 'packages/ui/src/langue/textes/fr/archiviste.ts', symbole: 'autre', texte: 'sources', nombre: 1, raison: 'pluriel du mot « source » dans le libellé d’un lot (« + 2 sources »), pas le dossier de la mémoire' },
	{ fichier: 'packages/ui/src/langue/textes/en/archiviste.ts', symbole: 'autre', texte: 'sources', nombre: 1, raison: 'pluriel anglais du mot « source » dans le libellé d’un lot, pas le dossier de la mémoire' },
	{ fichier: 'packages/mnemo/src/infra/plugins-claude.ts', symbole: 'DOSSIER_SKILLS_CLAUDE', texte: 'skills', nombre: 1, raison: 'dossier des skills dans l’arborescence de Claude Code (plugin ou ~/.claude), pas le dossier fixe de la mémoire' },
];
/** Fichiers de données d'exemple : chemins de fiches d'une mémoire fictive (mode démo), pas des noms de code. */
const DONNEES: readonly string[] = ['packages/ui/src/client/demo-donnees.ts', 'packages/ui/src/client/demo-volume.ts', 'packages/ui/src/client/demo-entrainement.ts'];

type Trouve = { fichier: string; symbole: string; ligne: number; texte: string };

/** Vrai si `texte` désigne un nom réservé comme chemin ou segment de chemin (la prose, avec espaces, n'en est pas). */
function designeUnNom(texte: string): boolean {
	if (/\s/u.test(texte)) return false;
	return texte.split('/').some((segment) => NOMS.includes(segment));
}

/** Vrai si le motif d'une expression régulière littérale contient un nom réservé comme segment de chemin (`nom\/`). */
function motifDesigneUnNom(motif: string): boolean {
	return NOMS.some((nom) => new RegExp(`(?:^/\\^?|[^\\p{L}\\p{N}_-])${nom}\\\\/`, 'u').test(motif));
}

/** Nom de la déclaration (variable, fonction, méthode, propriété) qui contient le nœud ; « » au niveau du module. */
function symboleDe(noeud: ts.Node): string {
	for (let n: ts.Node | undefined = noeud.parent; n !== undefined; n = n.parent) {
		if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isPropertyAssignment(n)) && n.name !== undefined && ts.isIdentifier(n.name)) return n.name.text;
	}
	return '';
}

/** Vrai si les chaînes admises par le type forment un ensemble fermé de littéraux (une fonction admise à côté ne compte pas). */
function estUnionDeLitteraux(type: ts.Type | undefined): boolean {
	if (type === undefined) return false;
	const chaines = (type.isUnion() ? type.types : [type]).filter((m) => (m.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0);
	return chaines.length > 0 && chaines.every((m) => m.isStringLiteral());
}

const COMPARAISONS = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken];
const REPLIS = [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken];

/** Type qui contraint le littéral : l'autre membre d'une comparaison ou d'un `switch`, sinon le type contextuel (à travers `??`, `||`, `? :`). */
function typeQuiContraint(noeud: ts.Node, verificateur: ts.TypeChecker): ts.Type | undefined {
	const parent = noeud.parent;
	if (ts.isBinaryExpression(parent) && COMPARAISONS.includes(parent.operatorToken.kind)) return verificateur.getTypeAtLocation(parent.left === noeud ? parent.right : parent.left);
	if (ts.isCaseClause(parent)) return verificateur.getTypeAtLocation(parent.parent.parent.expression);
	if ((ts.isBinaryExpression(parent) && REPLIS.includes(parent.operatorToken.kind)) || (ts.isConditionalExpression(parent) && parent.condition !== noeud)) return typeQuiContraint(parent, verificateur);
	return ts.isExpression(noeud) ? verificateur.getContextualType(noeud) : undefined;
}

function dansUnType(noeud: ts.Node): boolean {
	for (let n: ts.Node | undefined = noeud.parent; n !== undefined; n = n.parent) if (ts.isTypeNode(n)) return true;
	return false;
}

function litterauxDuPaquet(paquet: string): Trouve[] {
	const config = ts.getParsedCommandLineOfConfigFile(join(RACINE, paquet, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })!;
	// TypeScript nomme ses fichiers avec « / », Windows compris
	const sources = `${join(RACINE, paquet, 'src').split(sep).join('/')}/`;
	const programme = ts.createProgram({ rootNames: config.fileNames.filter((f) => f.startsWith(sources)), options: config.options });
	const verificateur = programme.getTypeChecker();
	const trouves: Trouve[] = [];
	for (const fichier of programme.getSourceFiles()) {
		if (!fichier.fileName.startsWith(sources)) continue;
		const chemin = relative(RACINE, fichier.fileName).split(sep).join('/');
		const visiter = (noeud: ts.Node): void => {
			const litteral = ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud) || ts.isTemplateHead(noeud) || ts.isTemplateMiddle(noeud) || ts.isTemplateTail(noeud);
			const module = ts.isImportDeclaration(noeud.parent ?? noeud) || ts.isExportDeclaration(noeud.parent ?? noeud);
			const nomEcrit = litteral && !module && designeUnNom(noeud.text) && !dansUnType(noeud) && !estUnionDeLitteraux(typeQuiContraint(noeud, verificateur));
			if (nomEcrit || (ts.isRegularExpressionLiteral(noeud) && motifDesigneUnNom(noeud.text))) {
				trouves.push({ fichier: chemin, symbole: symboleDe(noeud), ligne: fichier.getLineAndCharacterOfPosition(noeud.getStart()).line + 1, texte: noeud.text });
			}
			ts.forEachChild(noeud, visiter);
		};
		visiter(fichier);
	}
	return trouves;
}

describe('noms de la mémoire écrits une seule fois', () => {
	it('aucun nom de dossier, ni projet par défaut, ni profil archiviste hors de leur définition', () => {
		expect(dirname(DEFINITION)).toBe('packages/commun/src');
		const tous = PAQUETS.flatMap(litterauxDuPaquet);
		// le parcours voit bien la définition : il ne passe pas à vide
		expect(tous.filter((t) => t.fichier === DEFINITION).map((t) => t.texte).sort()).toEqual([...NOMS].sort());
		const restants = tous.filter((t) => t.fichier !== DEFINITION && !DONNEES.includes(t.fichier));
		const de = (e: (typeof EXCEPTIONS)[number]) => (t: Trouve) => t.fichier === e.fichier && t.symbole === e.symbole && t.texte === e.texte;
		for (const e of EXCEPTIONS) expect(restants.filter(de(e)).length, `exception ${e.fichier} ${e.symbole} « ${e.texte} »`).toBe(e.nombre);
		const fautifs = restants.filter((t) => !EXCEPTIONS.some((e) => de(e)(t)));
		expect(fautifs.map((t) => `${t.fichier}:${t.ligne} (${t.symbole}) « ${t.texte} »`)).toEqual([]);
	});
});
