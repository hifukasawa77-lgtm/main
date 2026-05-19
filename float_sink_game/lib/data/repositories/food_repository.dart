import '../datasources/food_data_source.dart';
import '../models/food_item.dart';

class FoodRepository {
  final FoodDataSource _dataSource;
  FoodRepository({FoodDataSource? dataSource}) : _dataSource = dataSource ?? FoodDataSource();

  Future<List<FoodItem>> getFoods() => _dataSource.loadFoods();
}
