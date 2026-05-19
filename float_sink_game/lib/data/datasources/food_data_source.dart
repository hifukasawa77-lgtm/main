import 'dart:convert';
import 'package:flutter/services.dart';
import '../models/food_item.dart';

class FoodDataSource {
  Future<List<FoodItem>> loadFoods() async {
    final jsonStr = await rootBundle.loadString('assets/data/foods.json');
    final list = jsonDecode(jsonStr) as List<dynamic>;
    return list.map((e) => FoodItem.fromJson(e as Map<String, dynamic>)).toList();
  }
}
