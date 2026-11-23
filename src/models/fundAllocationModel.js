// src/models/fundAllocationModel.js
module.exports = (sequelize, DataTypes) => {
  const FundAllocation = sequelize.define('FundAllocation', {
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
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
    },
    target: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
    },
    icon: {
      type: DataTypes.STRING(10),
      defaultValue: '📦',
    },
    color: {
      type: DataTypes.STRING(20),
      defaultValue: '#3B82F6',
    },
  }, {
    tableName: 'fund_allocations',
    underscored: true,
    timestamps: true,
  });

  FundAllocation.associate = (models) => {
    FundAllocation.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    FundAllocation.hasMany(models.Transaction, { foreignKey: 'allocation_id', as: 'transactions' });
    FundAllocation.hasMany(models.TransferLog, { foreignKey: 'from_allocation_id', as: 'transfersFrom' });
    FundAllocation.hasMany(models.TransferLog, { foreignKey: 'to_allocation_id', as: 'transfersTo' });
  };

  return FundAllocation;
};
