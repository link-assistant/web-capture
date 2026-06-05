import {
  isStackOverflowQuestionUrl,
  stackPrinterUrlForQuestion,
} from '../../src/lib.js';

describe('Stack Overflow URL helpers', () => {
  it('recognizes Stack Overflow question URLs', () => {
    expect(
      isStackOverflowQuestionUrl(
        'https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git'
      )
    ).toBe(true);
    expect(
      isStackOverflowQuestionUrl(
        'https://stackoverflow.com/questions/tagged/git'
      )
    ).toBe(false);
    expect(
      isStackOverflowQuestionUrl('https://serverfault.com/questions/927358')
    ).toBe(false);
  });

  it('builds a StackPrinter URL for direct captures', () => {
    const stackPrinterUrl = stackPrinterUrlForQuestion(
      'https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git'
    );

    expect(stackPrinterUrl).toBe(
      'https://stackprinter.appspot.com/export?question=927358&service=stackoverflow&language=en&hideAnswers=false&showAll=true&width=640'
    );
  });
});
