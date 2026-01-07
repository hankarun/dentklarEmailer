import fs from 'node:fs';
import pdfParse from 'pdf-parse';

export interface ParsedPdfData {
  name: string;
  anrede: string;
  extractedText: string;
  parsingMethod: string;
}

export interface ParserResult {
  name: string;
  anrede: string;
  extractedText: string;
}

export interface PdfParser {
  name: string;
  parse(text: string): ParserResult | null;
}

/**
 * Normalizes anrede values (e.g., "Herrn" -> "Herr")
 */
function normalizeAnrede(anrede: string): string {
  if (anrede.toLowerCase() === 'herrn') {
    return 'Herr';
  }
  return anrede.charAt(0).toUpperCase() + anrede.slice(1).toLowerCase();
}

/**
 * Extracts name and anrede from lines after a marker
 */
function extractFromLines(lines: string[]): { name: string; anrede: string } {
  let extractedName = '';
  let extractedAnrede = '';

  if (lines.length === 0) {
    return { name: extractedName, anrede: extractedAnrede };
  }

  let nameLineIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (line.match(/^(Herrn|Herr|Frau|Dr\.|Prof\.)$/i)) {
      extractedAnrede = normalizeAnrede(line);
      nameLineIndex = i + 1;
      break;
    } else if (i === 0) {
      nameLineIndex = 0;
    }
  }

  if (lines[nameLineIndex]) {
    extractedName = lines[nameLineIndex].trim();
  }

  return { name: extractedName, anrede: extractedAnrede };
}

/**
 * Parser: Extracts name after "Antragsnummer" marker
 */
const antragsnummerParser: PdfParser = {
  name: 'Antragsnummer',
  parse(text: string): ParserResult | null {
    const marker = 'Antragsnummer';
    const markerIndex = text.indexOf(marker);

    if (markerIndex === -1) return null;

    const textAfterMarker = text.substring(markerIndex + marker.length);
    const lines = textAfterMarker.split('\n').filter(line => line.trim().length > 0);

    if (lines.length === 0) return null;

    const potentialName = lines[0].trim();
    const isValidName = potentialName &&
      !potentialName.match(/^\d/) &&
      !potentialName.match(/^(Str\.|Straße|str\.|D\s*\d)/i);

    if (!isValidName) return null;

    return {
      name: potentialName,
      anrede: '',
      extractedText: lines.slice(0, 5).join('\n'),
    };
  },
};

/**
 * Parser: Extracts name and anrede after Dentklar marker
 */
const dentklarMarkerParser: PdfParser = {
  name: 'Dentklar marker',
  parse(text: string): ParserResult | null {
    const marker = 'Ugur Kaganaslan, Dentklar Digital Dental Studio BaG, Nassauische Str. 30,10717 Berlin';
    const markerIndex = text.indexOf(marker);

    if (markerIndex === -1) return null;

    const textAfterMarker = text.substring(markerIndex + marker.length);
    const lines = textAfterMarker.split('\n').filter(line => line.trim().length > 0);

    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      const line = lines[i].trim();
      if (line.match(/^(Herrn|Herr|Frau)$/i)) {
        const anrede = normalizeAnrede(line);
        const name = lines[i + 1]?.trim() || '';

        return {
          name,
          anrede,
          extractedText: lines.slice(0, 5).join('\n'),
        };
      }
    }

    return null;
  },
};

/**
 * Parser: Extracts name and anrede after "ZÄ Turan & Kaganaslan" marker
 */
const turanMarkerParser: PdfParser = {
  name: 'ZÄ Turan marker',
  parse(text: string): ParserResult | null {
    const marker = 'ZÄ Turan & Kaganaslan, Nassauische Str. 30, 10717 Berlin';
    const markerIndex = text.indexOf(marker);

    if (markerIndex === -1) return null;

    const textAfterMarker = text.substring(markerIndex + marker.length);
    const lines = textAfterMarker.split('\n').filter(line => line.trim().length > 0);

    const result = extractFromLines(lines);
    if (!result.name) return null;

    return {
      name: result.name,
      anrede: result.anrede,
      extractedText: lines.slice(0, 5).join('\n'),
    };
  },
};

/**
 * Parser: Fallback pattern search for Anrede anywhere in document
 */
const anredePatternParser: PdfParser = {
  name: 'Anrede pattern search',
  parse(text: string): ParserResult | null {
    const anredeMatch = text.match(
      /(Herrn|Herr|Frau)\s*\n\s*([A-ZÄÖÜa-zäöüß\-]+\s+[A-ZÄÖÜa-zäöüß\-]+)/i
    );

    if (!anredeMatch) return null;

    return {
      name: anredeMatch[2].trim(),
      anrede: normalizeAnrede(anredeMatch[1]),
      extractedText: anredeMatch[0],
    };
  },
};

/**
 * Ordered list of parsers to try (first match wins for name, others can augment anrede)
 */
const parsers: PdfParser[] = [
  antragsnummerParser,
  dentklarMarkerParser,
  turanMarkerParser,
  anredePatternParser,
];

/**
 * Main function to extract data from a PDF file
 */
export async function extractPdfData(filePath: string): Promise<{
  success: true;
  data: ParsedPdfData;
} | {
  success: false;
  error: string;
}> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const text = data.text;

    let result: ParsedPdfData | null = null;

    // Try each parser in order
    for (const parser of parsers) {
      const parserResult = parser.parse(text);

      if (parserResult?.name) {
        result = {
          name: parserResult.name,
          anrede: parserResult.anrede,
          extractedText: parserResult.extractedText,
          parsingMethod: parser.name,
        };
        break;
      }
    }

    // If we have a name but no anrede, try to find anrede from other parsers
    if (result && !result.anrede) {
      for (const parser of parsers) {
        if (parser.name === result.parsingMethod) continue;
        
        const parserResult = parser.parse(text);
        if (parserResult?.anrede) {
          result.anrede = parserResult.anrede;
          break;
        }
      }
    }

    if (!result) {
      return {
        success: false,
        error: 'Could not extract patient name from PDF. None of the parsing methods found valid data.',
      };
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
