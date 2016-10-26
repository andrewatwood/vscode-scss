'use strict';

import * as path from 'path';

import { TextDocument, Files } from 'vscode-languageserver';
import { getSCSSLanguageService } from 'vscode-css-languageservice';

import { INode } from '../types/nodes';
import { IDocument, ISymbols } from '../types/symbols';
import { ISettings } from '../types/settings';

import { findSymbols, findSymbolsAtOffset } from '../parser/symbols';
import { getNodeAtOffset } from '../utils/ast';

// SCSS Language Service
const ls = getSCSSLanguageService();

ls.configure({
	lint: false,
	validate: false
});

/**
 * Returns all Symbols in a single document.
 */
export function parseDocument(document: TextDocument, offset: number = null, settings: ISettings): IDocument {
	let symbols: ISymbols;
	try {
		symbols = findSymbols(document.getText());
	} catch (err) {
		if (settings.showErrors) {
			throw err;
		}

		symbols = {
			variables: [],
			mixins: [],
			functions: [],
			imports: []
		};
	}

	// Set path for document in Symbols collection
	symbols.document = Files.uriToFilePath(document.uri) || document.uri;

	// Get `<reference *> comments from document
	const references = document.getText().match(/\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/g);
	if (references) {
		references.forEach((x) => {
			symbols.imports.push({
				css: false,
				dynamic: false,
				filepath: /\/\/\s*<reference\s*path=["'](.*)['"]\s*\/?>/.exec(x)[1],
				reference: true
			});
		});
	}

	let ast: INode = null;
	if (offset) {
		ast = <INode>ls.parseStylesheet(document);

		const scopedSymbols = findSymbolsAtOffset(ast, offset);

		symbols.variables = symbols.variables.concat(scopedSymbols.variables);
		symbols.mixins = symbols.mixins.concat(scopedSymbols.mixins);
	}

	symbols.imports = symbols.imports.map((x) => {
		x.filepath = path.join(path.dirname(symbols.document), x.filepath);
		if (!x.css && !/\.scss$/.test(x.filepath)) {
			x.filepath += '.scss';
		}
		return x;
	});

	return {
		symbols,
		ast: offset ? getNodeAtOffset(ast, offset) : null
	};
}