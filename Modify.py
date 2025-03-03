import pandas as pd

# Define the dataset path (Assuming it's stored in /mnt/data after download)
dataset_path = "/content/station_data_dataverse.csv"  # Update the filename if needed

# Load the dataset
df = pd.read_csv(dataset_path)

# Select only the available relevant columns
df_filtered = df[['sessionId', 'kwhTotal', 'dollars', 'created', 'ended', 'startTime', 'endTime', 
                  'chargeTimeHrs', 'weekday', 'userId']].copy()

# Rename columns for consistency
df_filtered.rename(columns={'sessionId': 'id', 'kwhTotal': 'energy_used_kwh', 'dollars': 'price',
                            'created': 'start_time', 'ended': 'end_time', 'startTime': 'start_hour',
                            'endTime': 'end_hour', 'chargeTimeHrs': 'charging_duration',
                            'weekday': 'day_of_week', 'userId': 'user_id'}, inplace=True)

# Convert price from dollars to rupees (approximate conversion rate: 1 USD = 83 INR)
df_filtered['price'] = df_filtered['price'] * 83

# Remove rows where price is 0
df_filtered = df_filtered[df_filtered['price'] > 0]

# Sort dataset in ascending order of price
df_filtered = df_filtered.sort_values(by='price', ascending=True).reset_index(drop=True)

# Assign locations based on row ranges
df_filtered.loc[:194, 'location'] = "ECR, Chennai"
df_filtered.loc[195:245, 'location'] = "Pammal, Chennai"
df_filtered.loc[246:268, 'location'] = "Maduravoyal, Chennai"
df_filtered.loc[269:308, 'location'] = "Medavakkam, Chennai"  # Changed Perumbakkam to Medavakkam
df_filtered.loc[309:, 'location'] = "Anna Nagar, Chennai"

# Save the transformed dataset
updated_dataset_path = "/content/updated_ev_charging_data.csv"
df_filtered.to_csv(updated_dataset_path, index=False)

# Provide confirmation
print(f"Dataset saved successfully as: {updated_dataset_path}")
