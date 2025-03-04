document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('prediction-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorMessage = document.getElementById('error-message');
    const predictionResult = document.getElementById('prediction-result');
    const priceValue = document.getElementById('price-value');
    const locationNameInput = document.getElementById('location_name');
    const locationIdInput = document.getElementById('location');

    // Update location ID when location name changes
    locationNameInput.addEventListener('input', function(e) {
        locationIdInput.value = e.target.value ? '1' : '';
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI state
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
        predictionResult.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Calculating...';
        
        // Collect form data
        const formData = {
            location: locationIdInput.value,
            start_hour: document.getElementById('start_hour').value,
            end_hour: document.getElementById('end_hour').value,
            users_demand: document.getElementById('users_demand').value,
            day_of_week: document.getElementById('day_of_week').value
        };
        
        try {
            // Send request to Flask backend
            const response = await fetch('http://127.0.0.1:5000/predict',  {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            
            if (!response.ok) {
                throw new Error('Server returned an error: ' + response.status);
            }
            
            const data = await response.json();
            
            // Display prediction result
            if (data.predicted_price !== undefined) {
                priceValue.textContent = '$' + parseFloat(data.predicted_price).toFixed(2);
                predictionResult.classList.remove('hidden');
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err) {
            console.error('Error:', err);
            errorMessage.textContent = 'Failed to get prediction. Please try again.';
            errorMessage.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Book Charging Session';
        }
    });
});