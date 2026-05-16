class AppConfig {
  const AppConfig._();

  /// Raw GitHub URL for the static Re:Zero Arc 10 HTML files.
  static const String rawBaseUrl =
      'https://raw.githubusercontent.com/wdfazik/Re-Zero.-Arc-10/main/';

  static Uri rawUri(String path) => Uri.parse(rawBaseUrl).resolve(path);
}
