

First, create a .env file in the root of your project.
Use the .env.example file as a reference to configure your environment variables.
Run the following command to copy the .env.example file:
bash
Copy code
cp .env.example .env
Edit the .env file and add the necessary values for your environment variables.
Install dependencies:

After adding your environment variables, run the following command to install all the required dependencies:
bash

npm install
Run the server:

Once the dependencies are installed, you can start the server in development mode by running:
bash

npm run start:dev