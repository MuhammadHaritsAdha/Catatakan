// src/models/transferLogModel.js
module.exports = (sequelize, DataTypes) => {
  const TransferLog = sequelize.define('TransferLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    from_allocation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    to_allocation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    transfer_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'transfer_logs',
    underscored: true,
    timestamps: false,
  });

  TransferLog.associate = (models) => {
    TransferLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    TransferLog.belongsTo(models.FundAllocation, { foreignKey: 'from_allocation_id', as: 'fromAllocation' });
    TransferLog.belongsTo(models.FundAllocation, { foreignKey: 'to_allocation_id', as: 'toAllocation' });
  };

  return TransferLog;
};
