import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart';

import '../models/chapter.dart';
import '../services/reading_repository.dart';

class ReaderScreen extends StatefulWidget {
  const ReaderScreen({
    super.key,
    required this.chapter,
    required this.repository,
  });

  final Chapter chapter;
  final ReadingRepository repository;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  late Future<String> _chapterFuture;

  @override
  void initState() {
    super.initState();
    _chapterFuture = widget.repository.loadChapterBody(widget.chapter);
  }

  void _reload() {
    setState(() => _chapterFuture = widget.repository.loadChapterBody(widget.chapter));
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(widget.chapter.displayTitle)),
      body: FutureBuilder<String>(
        future: _chapterFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return _ReaderErrorState(onRetry: _reload, error: snapshot.error.toString());
          }

          return SelectionArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              child: HtmlWidget(
                snapshot.data ?? '',
                textStyle: TextStyle(
                  fontSize: 18,
                  height: 1.5,
                  color: colorScheme.onSurface,
                ),
                customStylesBuilder: (element) {
                  final classes = element.classes;
                  if (element.localName == 'p') {
                    return {'margin': '0 0 18px 0'};
                  }
                  if (classes.contains('location-tag')) {
                    return {
                      'text-align': 'center',
                      'margin': '0 0 26px 0',
                      'color': '#c8a46a',
                      'font-style': 'italic',
                    };
                  }
                  if (classes.contains('dialogue-block')) {
                    return {
                      'margin': '18px 0',
                      'padding': '14px 16px',
                      'border-left': '3px solid #c8a46a',
                      'background-color': colorScheme.surfaceContainerHighest.toCssRgba(0.36),
                    };
                  }
                  if (classes.contains('speaker-tag')) {
                    return {
                      'display': 'block',
                      'margin': '0 0 6px 0',
                      'font-weight': '700',
                      'color': '#c8a46a',
                    };
                  }
                  if (classes.contains('moment') ||
                      classes.contains('dragon-eye-reveal') ||
                      classes.contains('return-block')) {
                    return {
                      'margin': '22px 0',
                      'padding': '16px',
                      'border-radius': '14px',
                      'background-color': colorScheme.surfaceContainerHighest.toCssRgba(0.42),
                    };
                  }
                  if (classes.contains('section-divider')) {
                    return {
                      'text-align': 'center',
                      'margin': '32px 0',
                      'color': '#c8a46a',
                    };
                  }
                  return null;
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ReaderErrorState extends StatelessWidget {
  const _ReaderErrorState({required this.onRetry, required this.error});

  final VoidCallback onRetry;
  final String error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.menu_book_outlined, size: 48),
            const SizedBox(height: 16),
            Text(
              'Не удалось открыть главу',
              style: Theme.of(context).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}

extension _CssColor on Color {
  String toCssRgba(double alpha) {
    final a = alpha.clamp(0, 1).toStringAsFixed(2);
    return 'rgba($red, $green, $blue, $a)';
  }
}
