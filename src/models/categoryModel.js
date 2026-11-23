// src/models/categoryModel.js
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING(10),
      defaultValue: '🏷️',
    },
    color: {
      type: DataTypes.STRING(20),
      defaultValue: '#6B7280',
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'categories',
    underscored: true,
    timestamps: true,
  });

  Category.associate = (models) => {
    Category.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Category.hasMany(models.Transaction, { foreignKey: 'category_id', as: 'transactions' });
  };

  return Category;
};
