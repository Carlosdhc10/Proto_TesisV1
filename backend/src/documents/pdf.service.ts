import PDFParser from 'pdf2json';

type PdfText = {
  R: { T: string }[];
};

type PdfPage = {
  Texts: PdfText[];
};

type PdfData = {
  Pages: PdfPage[];
};

export function extractTextFromPDF(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (err: any) => {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err);

      reject(new Error(message));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: PdfData) => {
      let text = '';

      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((textItem) => {
          if (textItem.R?.[0]?.T) {
            text += decodeURIComponent(textItem.R[0].T) + ' ';
          }
        });
      });

      resolve(text);
    });

    void pdfParser.loadPDF(filePath);
  });
}
