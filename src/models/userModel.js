// src/models/userModel.js
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nim: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    campus: {
      type: DataTypes.STRING(100),
      defaultValue: 'Universitas',
    },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
  });

  User.associate = (models) => {
    User.hasMany(models.Transaction, { foreignKey: 'user_id', as: 'transactions' });
    User.hasMany(models.FundAllocation, { foreignKey: 'user_id', as: 'allocations' });
    User.hasMany(models.Category, { foreignKey: 'user_id', as: 'categories' });
  };

  return User;
};
