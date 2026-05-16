class Chapter {
  const Chapter({
    required this.number,
    required this.title,
    required this.path,
  });

  final int number;
  final String title;
  final String path;

  String get displayTitle => 'Глава $number · $title';
}
