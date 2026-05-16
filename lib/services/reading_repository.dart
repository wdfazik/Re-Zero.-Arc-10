import 'dart:async';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/chapter.dart';
import 'app_config.dart';
import 'rezero_html_parser.dart';

class ReadingRepository {
  ReadingRepository({
    required SharedPreferences preferences,
    http.Client? httpClient,
    ReZeroHtmlParser parser = const ReZeroHtmlParser(),
  })  : _preferences = preferences,
        _httpClient = httpClient ?? http.Client(),
        _parser = parser;

  static const _indexCacheKey = 'cache:index.html';
  static const _chapterCachePrefix = 'cache:chapter:';

  final SharedPreferences _preferences;
  final http.Client _httpClient;
  final ReZeroHtmlParser _parser;

  Future<List<Chapter>> loadChapters() async {
    final html = await _loadWithCache(
      uri: AppConfig.rawUri('index.html'),
      cacheKey: _indexCacheKey,
    );
    return _parser.parseChapters(html);
  }

  Future<String> loadChapterBody(Chapter chapter) async {
    final html = await _loadWithCache(
      uri: AppConfig.rawUri(chapter.path),
      cacheKey: '$_chapterCachePrefix${chapter.path}',
    );
    return _parser.parseChapterBody(html);
  }

  Future<String> _loadWithCache({
    required Uri uri,
    required String cacheKey,
  }) async {
    try {
      final response = await _httpClient.get(uri).timeout(const Duration(seconds: 12));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        await _preferences.setString(cacheKey, response.body);
        return response.body;
      }
      throw HttpException('HTTP ${response.statusCode}: $uri');
    } on Object {
      final cached = _preferences.getString(cacheKey);
      if (cached != null && cached.isNotEmpty) {
        return cached;
      }
      rethrow;
    }
  }
}

class HttpException implements Exception {
  const HttpException(this.message);

  final String message;

  @override
  String toString() => message;
}
