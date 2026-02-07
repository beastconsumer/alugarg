import 'package:intl/intl.dart';

class CurrencyFormatter {
  static final _brl = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

  static String brl(num value) {
    return _brl.format(value);
  }
}
