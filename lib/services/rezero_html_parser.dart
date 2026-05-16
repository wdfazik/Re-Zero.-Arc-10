import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

import '../models/chapter.dart';

class ReZeroHtmlParser {
  const ReZeroHtmlParser();

  /// index.html stores published chapters as:
  /// <a class="chapter-card available" href="10-13.html"> ... </a>
  /// Locked chapters are <div class="chapter-card"> blocks without href, so this
  /// selector intentionally reads only available chapter links.
  List<Chapter> parseChapters(String indexHtml) {
    final document = html_parser.parse(indexHtml);
    final chapterLinks = document.querySelectorAll('a.chapter-card.available');

    final chapters = <Chapter>[];
    for (final link in chapterLinks) {
      final href = link.attributes['href']?.trim();
      if (href == null || !RegExp(r'^10-\d+\.html$').hasMatch(href)) {
        continue;
      }

      final numberText = link.querySelector('.card-num')?.text.trim();
      final title = link.querySelector('.card-title')?.text.trim();
      final number = int.tryParse(numberText ?? '');

      if (number == null || title == null || title.isEmpty) {
        continue;
      }

      chapters.add(Chapter(number: number, title: title, path: href));
    }

    chapters.sort((a, b) => a.number.compareTo(b.number));
    return chapters;
  }

  /// Chapter pages put the novel body inside <main id="main-content">.
  /// Everything outside that container is header/title/navigation/settings/script
  /// chrome and is ignored by the mobile reader.
  String parseChapterBody(String chapterHtml) {
    final document = html_parser.parse(chapterHtml);
    final mainContent = document.querySelector('main#main-content');

    if (mainContent == null) {
      throw const FormatException('Не найден контейнер main#main-content.');
    }

    _stripPresentationOnlyClasses(mainContent);
    return mainContent.innerHtml.trim();
  }

  void _stripPresentationOnlyClasses(dom.Element root) {
    for (final element in root.querySelectorAll('.reveal')) {
      final classes = element.classes.toSet()..remove('reveal');
      element.attributes['class'] = classes.join(' ');
    }
  }
}
